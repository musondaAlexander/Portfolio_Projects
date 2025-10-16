# Solar Farm Pipeline Monitoring Architecture

## The Problem You Identified

> "We need a way to know if the data coming from the Solar Plant has been inserted into TDengine. Is the pipeline online?"

## The Solution

### 3-Layer Monitoring Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: PRODUCERS                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Solar Farm A │    │ Solar Farm B │    │ Solar Farm C │          │
│  │  100 panels  │    │  100 panels  │    │  100 panels  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                    │
│         │ ✅ Track:         │                   │                    │
│         │ - Messages sent   │                   │                    │
│         │ - Failures        │                   │                    │
│         │ - Latency         │                   │                    │
│         │ - Last success    │                   │                    │
│         └───────────────────┴───────────────────┘                    │
│                             │                                        │
│                 Store metrics in TDengine                           │
│                 renewables.producer_metrics                         │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 2: KAFKA                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Topic: solarfarma-metrics  │  Topic: solarfarmb-metrics   │    │
│  │  Topic: solarfarmc-metrics  │  Topic: pipeline-alerts      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│         ✅ Monitor via Kafka UI & Kestra:                           │
│         - Consumer lag (messages behind)                            │
│         - Throughput (messages/sec)                                │
│         - Partition health                                         │
│         - Alert topic for failures                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 3: CONSUMERS                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Kafka → TDengine Consumers (3 instances for parallelism)  │    │
│  └───────────────────────────┬────────────────────────────────┘    │
│                              │                                       │
│         ✅ Track:            │                                       │
│         - Messages consumed  │                                       │
│         - Messages written   │                                       │
│         - Write latency      │                                       │
│         - Kafka lag          │                                       │
│         - Last write time    │                                       │
│                              │                                       │
│                 Store metrics in TDengine                           │
│                 renewables.consumer_metrics                         │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 4: TDENGINE                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  renewables.solarfarms (300 sub-tables)                    │    │
│  │  renewables.producer_metrics                               │    │
│  │  renewables.consumer_metrics                               │    │
│  │  renewables.pipeline_health_summary                        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│         ✅ Verify:           │                                       │
│         - Records written in last minute                           │
│         - Active panels reporting                                  │
│         - Compare expected vs actual                               │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 5: KESTRA ORCHESTRATION                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Workflow: pipeline-health-monitor (every 30 seconds)      │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ 1. Check Kafka lag                                   │  │    │
│  │  │ 2. Check producer health from TDengine              │  │    │
│  │  │ 3. Check consumer health from TDengine              │  │    │
│  │  │ 4. Verify data flow (last 60 seconds)               │  │    │
│  │  │ 5. Calculate health score:                          │  │    │
│  │  │    - Expected: 1800 records/minute                  │  │    │
│  │  │    - Actual: Query TDengine                         │  │    │
│  │  │    - Health = (Actual / Expected) × 100%            │  │    │
│  │  │ 6. Store health summary in TDengine                 │  │    │
│  │  │ 7. Alert if health < 95%                            │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Workflow: alert-consumer (every minute)                   │    │
│  │  - Consumes from pipeline-alerts topic                     │    │
│  │  - Sends Slack/PagerDuty notifications                     │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORING DASHBOARDS                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │
│  │   Grafana     │  │  Kestra UI    │  │   Kafka UI    │          │
│  │  (Pipeline    │  │  (Workflows)  │  │  (Topics)     │          │
│  │   Health)     │  │               │  │               │          │
│  └───────────────┘  └───────────────┘  └───────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           ALERTING                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    Slack     │    │  PagerDuty   │    │    Email     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

## How It Answers Your Question

### "Is data being inserted into TDengine?"

**Real-Time Check (Every 30 seconds):**
```sql
SELECT 
  COUNT(*) as records_last_minute,
  COUNT(DISTINCT tbname) as active_panels
FROM renewables.solarfarms
WHERE ts >= NOW - 60s;
```

Expected:
- **1,800 records/minute** (3 farms × 100 panels × 6 records/min)
- **300 active panels**

If actual < 95% of expected → **ALERT**

### "Is the pipeline online?"

**Health Check Matrix:**

| Component | Metric | Threshold | Status |
|-----------|--------|-----------|--------|
| **Producers** | Last update < 30s ago | ✅ ONLINE | |
| **Kafka** | Lag < 1000 messages | ✅ HEALTHY | |
| **Consumers** | Writing to TDengine | ✅ ACTIVE | |
| **TDengine** | Receiving data | ✅ RECEIVING | |

All green = **PIPELINE ONLINE** ✅
Any red = **ALERT TRIGGERED** 🚨

### "We need almost 2-second visibility"

**Solution:**
- Producers emit metrics **every 10 seconds**
- Consumers emit metrics **every batch write**
- Kestra checks health **every 30 seconds**
- Kafka UI shows **real-time lag**
- Grafana dashboards **auto-refresh every 5 seconds**

**You can see pipeline status within 2 seconds** by checking:
1. Kafka UI (real-time)
2. Grafana dashboard (5s refresh)
3. TDengine query (instant)

## Kestra's Role

### What Kestra Does:

1. **🔄 Continuous Monitoring** (Every 30s)
   - Queries all metrics from TDengine
   - Checks Kafka consumer lag
   - Calculates health score
   - Stores trending data

2. **🚨 Intelligent Alerting**
   - Detects degradation early
   - Routes alerts by severity
   - Prevents alert fatigue
   - Provides context

3. **📊 Reporting**
   - Daily health summaries
   - SLA calculations
   - Trend analysis
   - Executive dashboards

4. **🔧 Orchestration**
   - Coordinates multiple checks
   - Manages dependencies
   - Handles retries
   - Logs everything

### Why Between Kafka and TDengine?

Kestra doesn't sit "between" them in the data flow.
It sits **alongside** as an observer and orchestrator:

```
Data Flow:
Producers → Kafka → Consumers → TDengine
              ↓
         (Messages)

Monitoring Flow:
Kestra → Kafka API (check lag)
      → TDengine (query metrics)
      → Compare & Alert
```

## Key Metrics You Can Monitor

### Producer Metrics (stored in TDengine)
```sql
SELECT * FROM renewables.producer_metrics ORDER BY ts DESC LIMIT 1;
```
- Total messages produced
- Total failures
- Last success time
- Production latency

### Consumer Metrics (stored in TDengine)
```sql
SELECT * FROM renewables.consumer_metrics ORDER BY ts DESC LIMIT 1;
```
- Total messages consumed
- Total written to TDengine
- Write latency
- Current Kafka lag

### Pipeline Health (calculated by Kestra)
```sql
SELECT * FROM renewables.pipeline_health_summary ORDER BY ts DESC LIMIT 10;
```
- Overall status (HEALTHY/DEGRADED/DOWN)
- Data flow percentage
- Active panels
- Alert level

## Alerting Scenarios

### Scenario 1: Producer Down
```
Producer A stops sending data
  ↓
30 seconds later: No new producer_metrics
  ↓
Kestra detects: producer stale > 30s
  ↓
Alert: "⚠️ Solar Farm A not reporting"
```

### Scenario 2: High Kafka Lag
```
Consumer falls behind (slow writes to TDengine)
  ↓
Kafka lag increases > 1000 messages
  ↓
Kestra detects: high lag
  ↓
Alert: "⚠️ Consumer lag high, data delayed"
```

### Scenario 3: Data Flow Degraded
```
Only 2 of 3 farms sending data
  ↓
Actual: 1200 records/min (should be 1800)
  ↓
Health: 66.7% (threshold: 95%)
  ↓
Alert: "🚨 Pipeline degraded, only 66.7% of expected data"
```

## How to Verify It's Working

### 1. Check Producer Health
```powershell
docker exec tdengine taos -s "
SELECT 
  tbname,
  LAST(messages_produced),
  LAST(messages_failed),
  (NOW - LAST(ts)) / 1000 as seconds_ago
FROM renewables.producer_metrics
GROUP BY tbname;
"
```

### 2. Check Consumer Health
```powershell
docker exec tdengine taos -s "
SELECT 
  LAST(messages_consumed),
  LAST(messages_written),
  LAST(write_latency_ms),
  LAST(kafka_lag)
FROM renewables.consumer_metrics;
"
```

### 3. Check Data Flow
```powershell
docker exec tdengine taos -s "
SELECT 
  COUNT(*) as last_minute,
  COUNT(*) / 1800.0 * 100 as health_pct
FROM renewables.solarfarms
WHERE ts >= NOW - 60s;
"
```

### 4. Check Kestra
Visit http://localhost:8080 and see `pipeline-health-monitor` executions.

### 5. Check Kafka UI
Visit http://localhost:8081 and see consumer lag.

## Summary

**You asked:** "How do we know if data is being inserted?"

**The answer:**
1. ✅ **Producers** track every message sent (stored in TDengine)
2. ✅ **Kafka** provides lag metrics (visible in Kafka UI)
3. ✅ **Consumers** track every message written (stored in TDengine)
4. ✅ **Kestra** validates end-to-end flow every 30 seconds
5. ✅ **Grafana** visualizes everything in real-time
6. ✅ **Alerts** notify you immediately when issues occur

**You get visibility in < 2 seconds via:**
- Grafana dashboard (5s refresh)
- Kafka UI (real-time)
- Direct TDengine query (instant)
- Kestra execution log (30s intervals)

This is a **production-grade monitoring setup** that ensures you always know the state of your pipeline! 🚀
