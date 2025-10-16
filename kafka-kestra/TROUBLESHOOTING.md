# Troubleshooting Guide

## 🔍 Common Issues and Solutions

### Issue 1: Grafana Dashboard Shows "No Data"

#### Symptoms
- All panels show "No data" message
- Dashboard loads but no visualizations appear
- Time-series charts are empty

#### Solutions

**Step 1: Check Datasource Connection**
```powershell
# Go to Grafana: http://localhost:3000
# Navigate to: ⚙️ Configuration → Data sources → TDengine
# Click: "Save & Test"
# Expected: ✅ "Data source is working"
```

If datasource test fails:
- Verify URL is exactly: `http://tdengine:6041` (must include `http://`)
- Check credentials: User: `root`, Password: `taosdata`
- Verify TDengine is running: `docker ps | grep tdengine`

**Step 2: Verify Data Exists in TDengine**
```powershell
# Check record count
docker exec tdengine taos -s "SELECT COUNT(*) FROM renewables.solarfarms;"

# Should show: 20,000+ records

# Check latest data
docker exec tdengine taos -s "SELECT ts, site, poweroutput_kw FROM renewables.solarfarms ORDER BY ts DESC LIMIT 5;"

# Timestamps should be within last 10-20 seconds
```

**Step 3: Hard Refresh Browser**
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
Linux: Ctrl + F5
```

**Step 4: Check Query Format**
Dashboard queries MUST use `"sql":` field (not `"query":`):
```powershell
# Verify correct format
Select-String -Path "grafana-dashboards\solar-farm-data.json" -Pattern '"sql":'
# Should show: 6 matches
```

---

### Issue 2: TDengine Datasource "Bad Gateway" Error

#### Symptoms
- Datasource test shows "502 Bad Gateway"
- Connection test fails
- Dashboard can't query TDengine

#### Solutions

**Check TDengine Container**
```powershell
# Verify TDengine is running and healthy
docker ps --filter "name=tdengine"
# Status should show: "Up X minutes (healthy)"

# Check TDengine logs
docker logs tdengine --tail 50
```

**Verify Network Connectivity**
```powershell
# Test connection from Grafana to TDengine
docker exec grafana ping -c 2 tdengine

# Test HTTP endpoint
docker exec grafana curl http://tdengine:6041/rest/sql -u root:taosdata -d "show databases"
```

**Recreate Datasource**
1. Go to: Configuration → Data sources → TDengine
2. Scroll to bottom and click "Delete"
3. Add new datasource:
   - Name: `TDengine`
   - URL: `http://tdengine:6041`
   - User: `root`
   - Password: `taosdata`
   - Default: ✅ Checked
4. Click "Save & Test"

---

### Issue 3: Containers Not Starting

#### Symptoms
- `docker-compose up -d` fails
- Services show "Exited" status
- Containers restart repeatedly

#### Solutions

**Check Port Conflicts**
```powershell
# Check if required ports are available
netstat -an | findstr "3000 6041 8081 8090 9092"

# If ports are in use, stop conflicting services or change ports in docker-compose.yml
```

**Check Docker Resources**
```powershell
# Ensure Docker has enough resources
# Docker Desktop → Settings → Resources
# Recommended: 4 CPUs, 8GB RAM
```

**View Container Logs**
```powershell
# Check why a container failed
docker logs <container-name>

# Examples:
docker logs grafana
docker logs tdengine
docker logs kafka
```

**Restart Services**
```powershell
# Stop all services
docker-compose down

# Start fresh
docker-compose up -d

# Check status
docker-compose ps
```

---

### Issue 4: No Data Flowing to TDengine

#### Symptoms
- TDengine has 0 records or record count not increasing
- Producers running but data not appearing
- Consumer not processing messages

#### Solutions

**Check Producers**
```powershell
# Verify all 3 producers are running
docker ps | grep producer

# Check producer logs for "Published message"
docker logs solarfarma-producer --tail 20
docker logs solarfarmb-producer --tail 20
docker logs solarfarmc-producer --tail 20
```

**Check Kafka Topics**
```powershell
# Access Kafka UI
# Open: http://localhost:8081
# Check: Topics → solarfarma-metrics, b-metrics, c-metrics
# Verify: Messages are being produced

# Or use CLI:
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

**Check Consumer**
```powershell
# Verify consumer is running
docker ps | grep consumer

# Check consumer logs for "Inserted X records"
docker logs kafka-consumer --tail 50

# Look for errors
docker logs kafka-consumer 2>&1 | findstr "error"
```

**Restart Data Pipeline**
```powershell
# Restart producers
docker restart solarfarma-producer solarfarmb-producer solarfarmc-producer

# Restart consumer
docker restart kafka-consumer

# Wait 30 seconds, then check TDengine
docker exec tdengine taos -s "SELECT COUNT(*) FROM renewables.solarfarms;"
```

---

### Issue 5: Time-Series Charts Show "No Data"

#### Symptoms
- Gauge and table panels work
- Time-series charts (power, temperature, wind) are empty
- Queries return data in TDengine CLI but not in Grafana

#### Solutions

**Verify Query Syntax**
Time-series queries must use simple SELECT (TDengine 3.x syntax):

✅ **Correct**:
```sql
SELECT ts, site, poweroutput_kw 
FROM renewables.solarfarms 
WHERE ts >= NOW() - 1h 
ORDER BY ts
```

❌ **Incorrect** (TDengine 2.x):
```sql
SELECT _wstart as ts, site, AVG(poweroutput_kw) 
FROM renewables.solarfarms 
WHERE ts >= NOW - 1h 
GROUP BY site, _wstart 
INTERVAL(1m)
```

**Test Query in TDengine**
```powershell
docker exec tdengine taos -s "SELECT ts, site, poweroutput_kw FROM renewables.solarfarms WHERE ts >= NOW() - 1h ORDER BY ts DESC LIMIT 10;"
```

If query works in CLI but not in Grafana:
- Check browser console (F12) for errors
- Verify time range is set to "Last 1 hour" or similar
- Clear browser cache and hard refresh

---

### Issue 6: Kestra Not Accessible

#### Symptoms
- Cannot access http://localhost:8090
- Kestra shows authentication errors
- Workflows not visible

#### Solutions

**Check Kestra Container**
```powershell
# Verify Kestra is running
docker ps | grep kestra

# Check Kestra logs
docker logs kestra --tail 50
```

**Verify PostgreSQL**
```powershell
# Kestra requires PostgreSQL
docker ps | grep kestra-postgres

# If not running, restart:
docker-compose restart kestra-postgres kestra
```

**Default Credentials**
- Email: `admin@solar.com`
- Password: `Admin1234`

**Reset Kestra**
```powershell
# Stop Kestra
docker stop kestra

# Remove Kestra data volume (⚠️ deletes workflows)
docker volume rm kafka-kestra_kestra-data

# Restart
docker-compose up -d kestra
```

---

### Issue 7: Dashboard Not Auto-Refreshing

#### Symptoms
- Data doesn't update automatically
- Must manually refresh to see new data
- Charts appear frozen

#### Solutions

**Check Refresh Setting**
1. Open dashboard
2. Look at top-right corner
3. Ensure refresh is set (e.g., "5s", "10s")
4. If showing "Off", click and select "5s"

**Check Browser Performance**
- Close other browser tabs
- Disable browser extensions
- Try different browser (Chrome, Firefox, Edge)

**Check Data Source**
```powershell
# Verify data is still flowing
docker exec tdengine taos -s "SELECT MAX(ts) FROM renewables.solarfarms;"
# Timestamp should be within last 10-20 seconds
```

---

### Issue 8: High Resource Usage

#### Symptoms
- Docker using too much CPU/RAM
- System becoming slow
- Containers crashing due to memory

#### Solutions

**Check Resource Usage**
```powershell
# View container stats
docker stats

# Identify high consumers
```

**Adjust Docker Resources**
- Docker Desktop → Settings → Resources
- Increase Memory limit to 8GB+
- Increase CPU limit to 4+

**Reduce Data Rate**
Edit `solarfarm-kafka-producer/producer.js`:
```javascript
// Change from 10 seconds to 30 seconds
setInterval(() => generateAndSendData(), 30000);
```

**Clean Up Old Data**
```sql
-- Connect to TDengine
docker exec -it tdengine taos

-- Delete old data (older than 1 day)
DELETE FROM renewables.solarfarms WHERE ts < NOW - 1d;
```

---

## 🧪 Diagnostic Commands

### System Health Check

```powershell
# 1. Check all containers
docker-compose ps

# 2. Verify data in TDengine
docker exec tdengine taos -s "SELECT COUNT(*), MAX(ts) FROM renewables.solarfarms;"

# 3. Check Grafana health
Invoke-RestMethod http://localhost:3000/api/health

# 4. Test datasource
$headers = @{Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin123"))}
Invoke-RestMethod -Uri "http://localhost:3000/api/datasources/uid/PCDB1A4F820EAA3DF/health" -Headers $headers

# 5. View recent logs
docker-compose logs --tail=100
```

### Network Diagnostics

```powershell
# Check Docker network
docker network ls | findstr solar

# Inspect network
docker network inspect kafka-kestra_solar-network

# Test connectivity between containers
docker exec grafana ping -c 2 tdengine
docker exec kafka-consumer ping -c 2 kafka
```

---

## 📞 Getting Help

### Before Reporting an Issue

1. ✅ Check this troubleshooting guide
2. ✅ Run diagnostic commands above
3. ✅ Collect relevant logs
4. ✅ Note exact error messages
5. ✅ Document steps to reproduce

### Useful Information to Provide

- Docker version: `docker --version`
- OS: Windows/Mac/Linux
- Available RAM/CPU
- Container status: `docker-compose ps`
- Error logs: `docker-compose logs`
- TDengine version: `docker exec tdengine taos -s "SELECT SERVER_VERSION();"`

---

## 🔄 Complete System Reset

If all else fails, perform a complete reset:

```powershell
# ⚠️ WARNING: This deletes ALL data

# 1. Stop all services
docker-compose down

# 2. Remove all volumes
docker-compose down -v

# 3. Remove Docker network
docker network prune -f

# 4. Pull latest images
docker-compose pull

# 5. Start fresh
docker-compose up -d

# 6. Wait for services to initialize (60 seconds)
Start-Sleep -Seconds 60

# 7. Verify
docker-compose ps
```

---

## ✅ Success Indicators

Your system is healthy when:

- ✅ `docker-compose ps` shows all containers "Up"
- ✅ TDengine has 20,000+ records: `docker exec tdengine taos -s "SELECT COUNT(*) FROM renewables.solarfarms;"`
- ✅ Latest data is recent: `docker exec tdengine taos -s "SELECT MAX(ts) FROM renewables.solarfarms;"`
- ✅ Grafana datasource test passes
- ✅ Dashboard shows data in all 6 panels
- ✅ Charts update every 5 seconds
- ✅ No errors in logs: `docker-compose logs --tail=50`

---

**If you're still experiencing issues after trying these solutions, check the README.md for additional resources or review the container logs for specific error messages.**
