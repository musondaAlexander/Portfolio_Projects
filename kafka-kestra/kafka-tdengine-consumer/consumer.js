const { Kafka } = require('kafkajs');
const taos = require("@tdengine/websocket");

// Configuration from environment variables
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'kafka:9092';
const TDENGINE_HOST = process.env.TDENGINE_HOST || 'tdengine';
const TDENGINE_USER = process.env.TDENGINE_USER || 'root';
const TDENGINE_PASS = process.env.TDENGINE_PASS || 'taosdata';
const CONSUMER_GROUP = process.env.CONSUMER_GROUP || 'tdengine-writers';
const CONSUMER_ID = process.env.HOSTNAME || `consumer-${Math.random().toString(36).substr(2, 9)}`;

console.log(`🚀 Starting Kafka → TDengine Consumer`);
console.log(`   Consumer ID: ${CONSUMER_ID}`);
console.log(`   Group: ${CONSUMER_GROUP}`);
console.log(`   Kafka: ${KAFKA_BROKERS}`);
console.log(`   TDengine: ${TDENGINE_HOST}`);

// Kafka setup
const kafka = new Kafka({
  clientId: `${CONSUMER_GROUP}-${CONSUMER_ID}`,
  brokers: KAFKA_BROKERS.split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ 
  groupId: CONSUMER_GROUP,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576, // 1MB per partition
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Metrics tracking
const metrics = {
  messagesConsumed: 0,
  messagesWritten: 0,
  messagesFailed: 0,
  lastConsumeTime: null,
  lastWriteTime: null,
  totalWriteLatency: 0,
  batchCount: 0,
  currentLag: 0
};

// TDengine connection
let tdengineConn = null;

/**
 * Initialize TDengine connection and create tables
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
    
    // Create main stable for solar farm data
    await tdengineConn.exec(`
      CREATE STABLE IF NOT EXISTS renewables.solarfarms (
        ts TIMESTAMP,
        ambienttemperature_c FLOAT,
        windspeed_mps FLOAT,
        poweroutput_kw FLOAT,
        current FLOAT,
        voltage FLOAT
      ) TAGS (
        panelid BINARY(50),
        string_id BINARY(50),
        site BINARY(50)
      );
    `);
    console.log('✅ Created stable: renewables.solarfarms');
    
    // Create consumer metrics table
    await tdengineConn.exec(`
      CREATE STABLE IF NOT EXISTS renewables.consumer_metrics (
        ts TIMESTAMP,
        messages_consumed BIGINT,
        messages_written BIGINT,
        messages_failed BIGINT,
        write_latency_ms INT,
        kafka_lag BIGINT
      ) TAGS (consumer_id BINARY(50));
    `);
    console.log('✅ Created stable: renewables.consumer_metrics');
    
    // Create pipeline health table
    await tdengineConn.exec(`
      CREATE TABLE IF NOT EXISTS renewables.pipeline_health (
        ts TIMESTAMP,
        component BINARY(50),
        status BINARY(20),
        message_count BIGINT,
        latency_ms INT,
        error_message BINARY(500)
      );
    `);
    console.log('✅ Created table: renewables.pipeline_health');
    
    console.log('✅ TDengine initialization complete\n');
    
  } catch (error) {
    console.error('❌ Failed to initialize TDengine:', error.message);
    throw error;
  }
}

/**
 * Store consumer metrics in TDengine
 */
async function storeConsumerMetrics(consumed, written, latency, lag) {
  if (!tdengineConn) return;
  
  try {
    const tableName = `${CONSUMER_ID.replace(/-/g, '_')}_consumer_metrics`;
    await tdengineConn.exec(`
      INSERT INTO renewables.\`${tableName}\`
      USING renewables.consumer_metrics TAGS('${CONSUMER_ID}')
      VALUES (
        NOW,
        ${metrics.messagesConsumed},
        ${metrics.messagesWritten},
        ${metrics.messagesFailed},
        ${latency},
        ${lag}
      )
    `);
  } catch (error) {
    console.error('⚠️  Failed to store consumer metrics:', error.message);
  }
}

/**
 * Store pipeline health status
 */
async function storePipelineHealth(component, status, count, latency, errorMsg) {
  if (!tdengineConn) return;
  
  try {
    const error = errorMsg ? errorMsg.substring(0, 500).replace(/'/g, "''") : '';
    await tdengineConn.exec(`
      INSERT INTO renewables.pipeline_health VALUES (
        NOW,
        '${component}',
        '${status}',
        ${count},
        ${latency},
        '${error}'
      )
    `);
  } catch (error) {
    console.error('⚠️  Failed to store pipeline health:', error.message);
  }
}

/**
 * Send message to dead letter queue
 */
async function sendToDeadLetter(message, error, topic) {
  try {
    const producer = kafka.producer();
    await producer.connect();
    
    await producer.send({
      topic: 'failed-messages-dlq',
      messages: [{
        value: message.value,
        headers: {
          'error': error.message,
          'original_topic': topic,
          'original_partition': message.partition?.toString() || '0',
          'original_offset': message.offset,
          'failed_at': new Date().toISOString(),
          'consumer_id': CONSUMER_ID
        }
      }]
    });
    
    await producer.disconnect();
    console.log(`📮 Sent failed message to DLQ`);
  } catch (err) {
    console.error('⚠️  Failed to send to DLQ:', err.message);
  }
}

/**
 * Send alert to pipeline-alerts topic
 */
async function sendAlert(component, errorMessage, severity = 'ERROR') {
  try {
    const producer = kafka.producer();
    await producer.connect();
    
    await producer.send({
      topic: 'pipeline-alerts',
      messages: [{
        value: JSON.stringify({
          component: component,
          consumer_id: CONSUMER_ID,
          consumer_group: CONSUMER_GROUP,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          severity: severity
        })
      }]
    });
    
    await producer.disconnect();
  } catch (error) {
    console.error('⚠️  Failed to send alert:', error.message);
  }
}

/**
 * Process and consume messages from Kafka
 */
async function consumeMessages() {
  await consumer.subscribe({ 
    topics: [
      'solarfarma-metrics',
      'solarfarmb-metrics', 
      'solarfarmc-metrics'
    ],
    fromBeginning: false 
  });

  console.log('✅ Subscribed to topics: solarfarma-metrics, solarfarmb-metrics, solarfarmc-metrics\n');
  console.log('🔄 Waiting for messages...\n');

  await consumer.run({
    autoCommit: false, // Manual commit for better control
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary, isRunning }) => {
      const startTime = Date.now();
      const queries = [];
      let successCount = 0;
      let failCount = 0;
      
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📥 Batch received: ${batch.messages.length} messages from ${batch.topic}`);
      console.log(`   Partition: ${batch.partition}, First offset: ${batch.messages[0]?.offset}`);
      
      for (let message of batch.messages) {
        try {
          const data = JSON.parse(message.value.toString());
          
          // Validate data structure
          if (!data.site || !data.string_id || !data.panel_id || !data.metrics) {
            throw new Error('Invalid message structure');
          }
          
          // Build TDengine sub-table name (replace hyphens with underscores for SQL compatibility)
          const subtable = `${data.site}_${data.string_id}_${data.panel_id}`.replace(/-/g, '_');
          
          // Build table insert clause (without INSERT INTO prefix for batching)
          const insertClause = `${subtable} USING renewables.solarfarms TAGS('${data.panel_id}', '${data.string_id}', '${data.site}') VALUES ('${data.timestamp}', ${data.metrics.ambienttemperature_c}, ${data.metrics.windspeed_mps}, ${data.metrics.poweroutput_kw}, ${data.metrics.current}, ${data.metrics.voltage})`;
          
          queries.push(insertClause);
          successCount++;
          
          // Send heartbeat to keep consumer alive
          await heartbeat();
          
        } catch (error) {
          console.error(`❌ Failed to parse message at offset ${message.offset}:`, error.message);
          failCount++;
          
          // Send to dead letter queue
          await sendToDeadLetter(message, error, batch.topic);
        }
      }
      
      // Batch write to TDengine
      if (queries.length > 0) {
        try {
          // Build single INSERT statement with multiple table clauses
          const batchQuery = `INSERT INTO ${queries.join(' ')}`;
          const writeStartTime = Date.now();
          
          await tdengineConn.exec(batchQuery);
          
          const writeEndTime = Date.now();
          const writeLatency = writeEndTime - writeStartTime;
          const totalLatency = writeEndTime - startTime;
          
          // Update metrics
          metrics.messagesConsumed += batch.messages.length;
          metrics.messagesWritten += successCount;
          metrics.messagesFailed += failCount;
          metrics.lastConsumeTime = new Date().toISOString();
          metrics.lastWriteTime = new Date().toISOString();
          metrics.totalWriteLatency += writeLatency;
          metrics.batchCount++;
          
          const avgWriteLatency = Math.round(metrics.totalWriteLatency / metrics.batchCount);
          
          console.log(`✅ Wrote ${successCount} records to TDengine`);
          console.log(`   Write latency: ${writeLatency}ms, Total: ${totalLatency}ms (avg: ${avgWriteLatency}ms)`);
          console.log(`📊 Totals: ${metrics.messagesConsumed} consumed, ${metrics.messagesWritten} written, ${metrics.messagesFailed} failed`);
          
          // Store consumer metrics
          await storeConsumerMetrics(batch.messages.length, successCount, writeLatency, metrics.currentLag);
          
          // Store pipeline health (success)
          await storePipelineHealth('consumer', 'healthy', successCount, writeLatency, null);
          
          // Commit offset after successful write
          await resolveOffset(batch.messages[batch.messages.length - 1].offset);
          await commitOffsetsIfNecessary();
          
          console.log(`✅ Committed offset: ${batch.messages[batch.messages.length - 1].offset}`);
          
        } catch (error) {
          console.error(`❌ Failed to write batch to TDengine:`, error.message);
          
          metrics.messagesFailed += successCount;
          
          // Store error health status
          await storePipelineHealth('consumer', 'error', 0, 0, error.message);
          
          // Send alert
          await sendAlert('Consumer', `Failed to write ${successCount} messages: ${error.message}`, 'CRITICAL');
          
          // Don't commit offset - will retry on next poll
          console.log(`⚠️  Offset NOT committed - will retry`);
        }
      }
      
      console.log(`${'─'.repeat(60)}\n`);
    }
  });
}

/**
 * Monitor consumer lag
 */
async function monitorLag() {
  setInterval(async () => {
    try {
      const admin = kafka.admin();
      await admin.connect();
      
      const offsets = await admin.fetchOffsets({ 
        groupId: CONSUMER_GROUP 
      });
      
      let totalLag = 0;
      for (const topic of offsets) {
        for (const partition of topic.partitions) {
          const lag = parseInt(partition.offset) - parseInt(partition.metadata);
          totalLag += Math.max(0, lag);
        }
      }
      
      metrics.currentLag = totalLag;
      
      if (totalLag > 1000) {
        console.log(`⚠️  High lag detected: ${totalLag} messages behind`);
      }
      
      await admin.disconnect();
    } catch (error) {
      console.error('⚠️  Failed to check lag:', error.message);
    }
  }, 30000); // Every 30 seconds
}

/**
 * Main startup function
 */
async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`   Kafka → TDengine Consumer`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Initialize TDengine
    await initTDengine();
    
    // Connect to Kafka
    await consumer.connect();
    console.log(`✅ Connected to Kafka: ${KAFKA_BROKERS}\n`);
    
    // Start lag monitoring
    monitorLag();
    
    // Start consuming messages
    await consumeMessages();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await sendAlert('Consumer', `Fatal error: ${error.message}`, 'CRITICAL');
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down consumer...');
  
  try {
    await consumer.disconnect();
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
  sendAlert('Consumer', `Uncaught exception: ${error.message}`, 'CRITICAL');
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection:', reason);
  sendAlert('Consumer', `Unhandled rejection: ${reason}`, 'CRITICAL');
  shutdown();
});

// Start the consumer
run();
