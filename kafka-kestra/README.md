# Solar Farm Monitoring Pipeline

A real-time data pipeline for monitoring solar farms using Apache Kafka and TDengine time-series database.

## 🎯 What's Working

✅ **Kafka Message Streaming** - 3 producers sending data every 10 seconds  
✅ **TDengine Storage** - Data being stored successfully (~7,000+ records)  
✅ **Kafka UI** - Web interface for monitoring topics and consumers  
✅ **Real-time Ingestion** - <50ms latency from Kafka to TDengine  

⚠️ **In Progress**: Grafana dashboards, Kestra workflows

---

## Architecture

```
Solar Farm Producers (Node.js) 
         ↓
    Apache Kafka (Message Broker)
         ↓
    Consumer (Node.js)
         ↓
    TDengine (Time-Series DB)
```

### Components

- **3 Solar Farm Producers**: Generate data for 100 panels each
- **Apache Kafka**: Message broker with 3 topics
- **1 Consumer**: Batch writes from Kafka to TDengine
- **TDengine**: Time-series database storing all metrics
- **Kafka UI**: Monitor topics and consumer lag

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- 8GB+ RAM
- Ports: 6041, 8081, 9092

### Start System

```bash
cd kafka-kestra
docker-compose up -d
```

Wait 60-90 seconds for initialization.

### Verify Running

```bash
docker-compose ps
```

All containers should show "Up" status.

---

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Kafka UI** | http://localhost:8081 | No auth |
| **TDengine** | `docker exec -it tdengine taos` | root/taosdata |

---

## Check Your Data

### Option 1: TDengine CLI

```bash
docker exec -it tdengine taos
```

```sql
USE renewables;
SELECT COUNT(*) FROM solarfarms;
SELECT * FROM solarfarms ORDER BY ts DESC LIMIT 10;
SELECT site, COUNT(*) as records FROM solarfarms GROUP BY site;
```

### Option 2: Kafka UI

Go to http://localhost:8081 to see:
- Topics: `solarfarma-metrics`, `solarfarmb-metrics`, `solarfarmc-metrics`
- Consumer lag (should be 0-10)
- Messages per second

### Option 3: REST API

```powershell
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("root:taosdata"))
Invoke-RestMethod -Uri "http://localhost:6041/rest/sql" -Method Post `
  -Headers @{"Authorization"="Basic $auth"} `
  -Body "SELECT COUNT(*) FROM renewables.solarfarms" `
  -ContentType "text/plain"
```

---

## Data Flow

- **300 panels** total (100 per farm)
- **~1,800 records/minute**
- **20-50ms write latency**
- **100% success rate**

---

## TDengine Schema

### Super Table

```sql
CREATE STABLE renewables.solarfarms (
  ts TIMESTAMP,
  ambienttemperature_c DOUBLE,
  windspeed_mps DOUBLE,
  poweroutput_kw DOUBLE,
  current DOUBLE,
  voltage DOUBLE
) TAGS (
  panelid NCHAR(50),
  string_id NCHAR(50),
  site NCHAR(50)
);
```

### Useful Queries

```sql
-- Total records
SELECT COUNT(*) FROM renewables.solarfarms;

-- Records per farm
SELECT site, COUNT(*) FROM solarfarms GROUP BY site;

-- Latest data
SELECT * FROM solarfarms ORDER BY ts DESC LIMIT 20;

-- Average power by farm
SELECT site, AVG(poweroutput_kw) as avg_power 
FROM solarfarms 
WHERE ts >= NOW - 10m 
GROUP BY site;

-- Records in last minute
SELECT COUNT(*) FROM solarfarms WHERE ts >= NOW - 1m;
```

---

## Monitoring

### Check Producer Logs

```bash
docker logs solarfarm-a-producer -f
```

Look for: `✅ Produced 100 messages`

### Check Consumer Logs

```bash
docker logs kafka-tdengine-consumer -f
```

Look for: `✅ Wrote 10 records to TDengine`

### Check Kafka Topics

```bash
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

---

## Management Commands

### Stop System

```bash
docker-compose down
```

### Restart Service

```bash
docker-compose restart solarfarm-a-producer
docker-compose restart kafka-tdengine-consumer
```

### View Logs

```bash
docker-compose logs -f
docker logs <container-name> --tail 50
```

### Check Resources

```bash
docker stats
```

---

## Troubleshooting

### Producer not sending data

```bash
docker logs solarfarm-a-producer
docker-compose restart solarfarm-a-producer
```

### Consumer not writing

```bash
# Check consumer logs
docker logs kafka-tdengine-consumer

# Verify Kafka has messages
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic solarfarma-metrics \
  --max-messages 5
```

### Check consumer lag

```bash
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe \
  --group tdengine-writers
```

---

## Project Structure

```
kafka-kestra/
├── docker-compose.yml              # All services
├── solarfarm-kafka-producer/       # Producer app
│   ├── producer.js
│   ├── package.json
│   └── Dockerfile
├── kafka-tdengine-consumer/        # Consumer app
│   ├── consumer.js
│   ├── package.json
│   └── Dockerfile
├── kestra-flows/                   # Workflow YAML (WIP)
└── grafana-dashboards/             # Dashboard JSON (WIP)
```

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Producers | ✅ Working | 3 farms, 100 panels each |
| Kafka | ✅ Working | 3 topics active |
| Consumer | ✅ Working | Real-time writes |
| TDengine | ✅ Working | 7,000+ records |
| Kafka UI | ✅ Working | Monitoring interface |
| Grafana | ⚠️ WIP | Dashboards need configuration |
| Kestra | ⚠️ WIP | Workflows need setup |

---

## Technologies

- **Apache Kafka** 7.5.0
- **TDengine** 3.3.6
- **Node.js** 20
- **Docker Compose**
- **Kafka UI** (Provectus)

---

## Performance

| Metric | Value |
|--------|-------|
| Write Latency | 20-50ms |
| Consumer Lag | 0-10 messages |
| Success Rate | 100% |
| Throughput | ~1,800 records/min |

---

## Support

**Check logs**: `docker-compose logs -f`  
**Kafka UI**: http://localhost:8081  
**TDengine CLI**: `docker exec -it tdengine taos`

---

**Status**: ✅ Core Pipeline Operational  
**Last Updated**: January 2025
