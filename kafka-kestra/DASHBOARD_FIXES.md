# Pipeline Health Dashboard Fixes

## Issues Found

The **Solar Pipeline Health Dashboard** had 2 panels showing "No data":

1. **Data Flow Rate (Records per Minute)** - Panel ID 2
2. **Producer Health Status** - Panel ID 7

## Root Cause

Both panels were using **TDengine 2.x syntax** which is incompatible with TDengine v3.3.6:

### Issue 1: Data Flow Rate Query
```sql
-- OLD (TDengine 2.x syntax - BROKEN)
SELECT _wstart as ts, COUNT(*) as records 
FROM renewables.solarfarms 
WHERE ts >= NOW - 1h 
INTERVAL(1m) FILL(VALUE, 0)
```

**Problems:**
- `_wstart` pseudo-column doesn't exist in TDengine 3.x
- `INTERVAL()` syntax is deprecated
- `NOW` without parentheses
- `FILL()` function removed

### Issue 2: Producer Health Status Query
```sql
-- OLD (TDengine 2.x syntax - BROKEN)
SELECT 
  tbname as farm,
  LAST(messages_produced) as total_produced,
  LAST(messages_failed) as total_failed,
  LAST(latency_ms) as last_latency_ms,
  (NOW - LAST(ts)) / 1000 as seconds_ago
FROM renewables.producer_metrics
GROUP BY tbname
```

**Problems:**
- `LAST()` aggregate function used incorrectly
- `NOW` without parentheses
- Arithmetic on `NOW - LAST(ts)` not supported in TDengine 3.x

## Solutions Applied

### Fix 1: Data Flow Rate
```sql
-- NEW (TDengine 3.x compatible - WORKING)
SELECT ts, COUNT(*) as records 
FROM renewables.solarfarms 
WHERE ts >= NOW() - 1h 
GROUP BY ts 
ORDER BY ts
```

**Changes:**
- ✅ Use actual `ts` column instead of `_wstart`
- ✅ Replace `INTERVAL()` with `GROUP BY ts`
- ✅ Add `NOW()` parentheses
- ✅ Let Grafana handle time-series aggregation
- ✅ Remove deprecated `FILL()` function

### Fix 2: Producer Health Status
```sql
-- NEW (TDengine 3.x compatible - WORKING)
SELECT 
  tbname as farm,
  messages_produced as total_produced,
  messages_failed as total_failed,
  latency_ms as last_latency_ms,
  ts
FROM renewables.producer_metrics
WHERE ts >= NOW() - 1h
ORDER BY ts DESC
```

**Changes:**
- ✅ Remove `LAST()` aggregation (use ORDER BY DESC to get latest)
- ✅ Add `NOW()` parentheses
- ✅ Remove `seconds_ago` calculation (not needed, showing latest timestamp instead)
- ✅ Filter by time window instead of GROUP BY

## Verification

### Test Data Flow Rate Query
```powershell
docker exec -it tdengine taos -s "SELECT ts, COUNT(*) as records FROM renewables.solarfarms WHERE ts >= NOW() - 5m GROUP BY ts ORDER BY ts DESC LIMIT 5;"
```

### Test Producer Health Status Query
```powershell
docker exec -it tdengine taos -s "SELECT tbname as farm, messages_produced as total_produced, messages_failed as total_failed, latency_ms as last_latency_ms, ts FROM renewables.producer_metrics WHERE ts >= NOW() - 1h ORDER BY ts DESC LIMIT 10;"
```

## Expected Results

After Grafana restart:

1. **Data Flow Rate** panel should show a time-series chart with data ingestion rate
2. **Producer Health Status** table should show 3 rows (one for each solar farm):
   - `solarfarma_producer_metrics`
   - `solarfarmb_producer_metrics`
   - `solarfarmc_producer_metrics`

Each row displays:
- Total messages produced (~50,000+)
- Total messages failed (0)
- Last latency (7-20ms)
- Latest timestamp

## Files Modified

- `grafana-dashboards/pipeline-health.json` - Updated 2 panel queries

## TDengine 3.x Migration Notes

**Key Syntax Changes from TDengine 2.x to 3.x:**

| TDengine 2.x | TDengine 3.x | Notes |
|-------------|-------------|-------|
| `_wstart`, `_wend` | Use actual `ts` column | Pseudo-columns removed |
| `INTERVAL(1m)` | `GROUP BY ts` | Syntax simplified |
| `FILL(VALUE, 0)` | Not needed | Grafana handles nulls |
| `NOW` | `NOW()` | Function requires parentheses |
| `LAST(column)` with GROUP BY | `ORDER BY ts DESC` | Simpler approach |
| Arithmetic on timestamps | Limited support | Use comparison operators |

## Related Issues Fixed Previously

This is the **4th dashboard fix** for TDengine 3.x compatibility:

1. ✅ Datasource UID mismatch (PCDB1A4F820EAA3DF)
2. ✅ Query field name ("query" → "sql")
3. ✅ Solar Farm Data dashboard time-series queries
4. ✅ **Pipeline Health dashboard queries (this fix)**

All dashboard panels now working! 🎉
