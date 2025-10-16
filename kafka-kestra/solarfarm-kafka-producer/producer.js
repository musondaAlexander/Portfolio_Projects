const { Kafka } = require('kafkajs');
const taos = require("@tdengine/websocket");
const Mock = require("mockjs");
const moment = require("moment-timezone");
const { fetchWeatherApi } = require('openmeteo');

// Configuration from environment variables
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'kafka:9092';
const FARM_ID = process.env.FARM_ID || 'solarfarma';
const TDENGINE_HOST = process.env.TDENGINE_HOST || 'tdengine';
const TDENGINE_USER = process.env.TDENGINE_USER || 'root';
const TDENGINE_PASS = process.env.TDENGINE_PASS || 'taosdata';
const TZ = process.env.TZ || 'America/Los_Angeles';

console.log(`🚀 Starting Solar Farm Producer: ${FARM_ID}`);
console.log(`   Kafka: ${KAFKA_BROKERS}`);
console.log(`   TDengine: ${TDENGINE_HOST}`);

// Kafka setup
const kafka = new Kafka({
  clientId: `${FARM_ID}-producer`,
  brokers: KAFKA_BROKERS.split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
  maxInFlightRequests: 5,
  idempotent: true, // Exactly-once semantics
  compression: 1, // GZIP compression
  acks: -1 // All replicas must acknowledge (required for idempotent)
});

// Metrics tracking
const metrics = {
  messagesProduced: 0,
  messagesFailed: 0,
  lastSuccessTime: null,
  lastFailureTime: null,
  totalLatency: 0,
  batchCount: 0
};

// TDengine connection for metrics storage
let tdengineConn = null;

// GPS coordinates for solar farms
const GPS_COORDINATES = {
  "solarfarma": { lat: "37.041", lon: "-120.92" },
  "solarfarmb": { lat: "37.61", lon: "-121.90" },
  "solarfarmc": { lat: "33.71", lon: "-115.45" }
};

// Weather cache
let weatherCache = {
  temperature: 25,
  windspeed: 5,
  lastUpdate: null
};

/**
 * Initialize TDengine connection and create monitoring tables
 */
async function initTDengine() {
  try {
    let conf = new taos.WSConfig(`ws://${TDENGINE_HOST}:6041`);
    conf.setUser(TDENGINE_USER);
    conf.setPwd(TDENGINE_PASS);
    
    // First connect without database
    const tempConn = await taos.sqlConnect(conf);
    
    // Create database if not exists
    await tempConn.exec(`CREATE DATABASE IF NOT EXISTS renewables KEEP 365 DURATION 10`);
    console.log('✅ Database renewables ready');
    
    await tempConn.close();
    
    // Now connect with database
    conf.setDb('renewables');
    tdengineConn = await taos.sqlConnect(conf);
    
    // Create producer metrics table
    await tdengineConn.exec(`
      CREATE STABLE IF NOT EXISTS renewables.producer_metrics (
        ts TIMESTAMP,
        messages_produced BIGINT,
        messages_failed BIGINT,
        batch_size INT,
        latency_ms INT
      ) TAGS (producer_id BINARY(50));
    `);
    
    console.log('✅ TDengine monitoring initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TDengine:', error.message);
    // Continue without TDengine metrics (Kafka still works)
  }
}

/**
 * Fetch weather data from Open-Meteo API
 */
async function getWeather(lat, lon) {
  try {
    const params = {
      latitude: lat,
      longitude: lon,
      current: ["temperature_2m", "wind_speed_10m"],
      wind_speed_unit: "ms",
      timezone: "America/Los_Angeles"
    };
    
    const responses = await fetchWeatherApi('https://api.open-meteo.com/v1/forecast', params);
    const response = responses[0];
    const current = response.current();
    
    const temp = current.variables(0).value();
    const wind = current.variables(1).value();
    
    console.log(`🌤️  Weather update: ${temp}°C, Wind: ${wind} m/s`);
    
    return {
      temperature: temp,
      windspeed: wind
    };
  } catch (error) {
    console.error('⚠️  Weather API error:', error.message);
    return weatherCache; // Return cached values
  }
}

/**
 * Generate mock solar panel data
 */
function generateMockData(temperature, windspeed) {
  const windspeedf = parseFloat(windspeed) + Mock.Random.float(0, 2);
  const windspeedFinal = parseFloat(windspeedf.toFixed(2));
  const tempFinal = parseFloat(temperature);
  
  // Solar radiation calculation (W/m²)
  const radiation = Mock.Random.float(790, 820);
  const efficiency = 0.29; // 29% panel efficiency
  const area = 1.5; // 1.5 m² panel area
  
  // Power output calculation
  const poweroutput = radiation * efficiency * area;
  
  // Temperature coefficient effect
  const deltaT = tempFinal - 4.0 - 25.0;
  const tempCoeff = -0.0045;
  const powerouteff = poweroutput * (1 + (tempCoeff * deltaT));
  
  // Current and voltage calculation
  const current = 9.0 * (radiation / 1000);
  const voltage = powerouteff / current;
  
  return {
    ambienttemperature_c: tempFinal.toFixed(2),
    windspeed_mps: windspeedFinal,
    poweroutput_kw: powerouteff.toFixed(2),
    current: current.toFixed(2),
    voltage: voltage.toFixed(2)
  };
}

/**
 * Store producer metrics in TDengine
 */
async function storeProducerMetrics(batchSize, latency) {
  if (!tdengineConn) return;
  
  try {
    const tableName = `${FARM_ID}_producer_metrics`;
    await tdengineConn.exec(`
      INSERT INTO renewables.\`${tableName}\`
      USING renewables.producer_metrics TAGS('${FARM_ID}')
      VALUES (
        NOW,
        ${metrics.messagesProduced},
        ${metrics.messagesFailed},
        ${batchSize},
        ${latency}
      )
    `);
  } catch (error) {
    console.error('⚠️  Failed to store producer metrics:', error.message);
  }
}

/**
 * Send alert to Kafka pipeline-alerts topic
 */
async function sendAlert(component, errorMessage, severity = 'ERROR') {
  try {
    await producer.send({
      topic: 'pipeline-alerts',
      messages: [{
        value: JSON.stringify({
          component: component,
          producer_id: FARM_ID,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          severity: severity
        })
      }]
    });
  } catch (error) {
    console.error('⚠️  Failed to send alert:', error.message);
  }
}

/**
 * Main data production loop
 */
async function produceData() {
  const STRINGS = 10; // 10 strings per farm
  const PANELS = 10;  // 10 panels per string = 100 panels total
  
  const coordinates = GPS_COORDINATES[FARM_ID];
  
  // Initial weather fetch
  weatherCache = await getWeather(coordinates.lat, coordinates.lon);
  weatherCache.lastUpdate = Date.now();
  
  // Update weather every 5 minutes
  setInterval(async () => {
    const newWeather = await getWeather(coordinates.lat, coordinates.lon);
    weatherCache = { ...newWeather, lastUpdate: Date.now() };
  }, 5 * 60 * 1000);
  
  // Produce data every 10 seconds
  setInterval(async () => {
    const startTime = Date.now();
    const messages = [];
    
    // Generate messages for all 100 panels
    for (let s = 0; s < STRINGS; s++) {
      for (let p = 0; p < PANELS; p++) {
        const timestamp = new Date().toISOString();
        const mockData = generateMockData(weatherCache.temperature, weatherCache.windspeed);
        
        const messageKey = `${FARM_ID}-string${s}-panel${p}`;
        
        messages.push({
          key: messageKey,
          value: JSON.stringify({
            site: FARM_ID,
            string_id: `string${s}`,
            panel_id: `panel${p}`,
            timestamp: timestamp,
            metrics: {
              ambienttemperature_c: parseFloat(mockData.ambienttemperature_c),
              windspeed_mps: mockData.windspeed_mps,
              poweroutput_kw: parseFloat(mockData.poweroutput_kw),
              current: parseFloat(mockData.current),
              voltage: parseFloat(mockData.voltage)
            }
          }),
          headers: {
            'producer_id': FARM_ID,
            'produced_at': timestamp,
            'string_id': `string${s}`
          },
          partition: s // Partition by string for parallelism
        });
      }
    }
    
    try {
      // Send batch to Kafka
      const result = await producer.send({
        topic: `${FARM_ID}-metrics`,
        messages: messages,
        acks: -1, // All replicas must acknowledge (required for idempotent)
        timeout: 30000
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Update metrics
      metrics.messagesProduced += messages.length;
      metrics.lastSuccessTime = new Date().toISOString();
      metrics.totalLatency += latency;
      metrics.batchCount++;
      
      const avgLatency = Math.round(metrics.totalLatency / metrics.batchCount);
      
      console.log(`✅ Produced ${messages.length} messages in ${latency}ms (avg: ${avgLatency}ms)`);
      console.log(`📊 Total: ${metrics.messagesProduced} produced, ${metrics.messagesFailed} failed`);
      
      // Store metrics in TDengine
      await storeProducerMetrics(messages.length, latency);
      
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      metrics.messagesFailed += messages.length;
      metrics.lastFailureTime = new Date().toISOString();
      
      console.error(`❌ Failed to produce messages after ${latency}ms:`, error.message);
      
      // Send alert
      await sendAlert('Producer', error.message, 'CRITICAL');
      
      // Store failed metrics
      await storeProducerMetrics(0, latency);
    }
    
  }, 10000); // Every 10 seconds
}

/**
 * Main startup function
 */
async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`   Solar Farm Producer: ${FARM_ID}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Connect to Kafka
    await producer.connect();
    console.log(`✅ Connected to Kafka: ${KAFKA_BROKERS}`);
    
    // Initialize TDengine (optional, for metrics)
    await initTDengine();
    
    // Start producing data
    console.log(`\n🔄 Starting data production (100 panels, every 10 seconds)...\n`);
    await produceData();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down producer...');
  
  try {
    await producer.disconnect();
    console.log('✅ Kafka disconnected');
    
    if (tdengineConn) {
      await tdengineConn.close();
      console.log('✅ TDengine disconnected');
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the producer
run();
