# Troubleshooting Guide - Real-time User Pipeline

## 🚨 Common Issues and Solutions

### Issue 1: No Data in Grafana Dashboard

#### Symptoms
- All panels show "No data"
- Dashboard loads but appears empty
- Time series shows no activity

#### Diagnosis Steps

**Step 1: Check if workflow has executed**
```powershell
# Check Kestra logs
docker logs kestra --tail 50

# Look for successful execution messages
# Should see: "✅ Transformed X user records"
#            "💾 Successfully loaded X users to database"
```

**Step 2: Verify database has data**
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT COUNT(*) FROM public.incoming_users;"
```

Expected output: Count > 0

**Step 3: Check Grafana data source**
1. Go to http://localhost:3000
2. **Configuration** → **Data sources**
3. Click **Analytics PostgreSQL**
4. Scroll down and click **Test**
5. Should show: "Database Connection OK"

#### Solutions

**Solution A: Trigger workflow manually**
1. Go to http://localhost:8090
2. Navigate to `demo.synthetic_users_realtime`
3. Click **Execute** button
4. Wait 30 seconds
5. Refresh Grafana dashboard

**Solution B: Verify data source UID**
```powershell
# Check Grafana provisioning file
cat grafana/provisioning/datasources/analytics-postgres.yml
# Should contain: uid: P1A0B00DDA2590108
```

**Solution C: Recreate table**
```sql
-- Connect to database
docker exec -it analytics-postgres psql -U analytics_user -d analytics

-- Drop and recreate (workflow will recreate automatically)
DROP TABLE IF EXISTS public.incoming_users;

-- Then trigger workflow in Kestra
```

---

### Issue 2: Workflow Execution Fails

#### Symptoms
- Workflow shows "FAILED" status in Kestra
- Error messages in execution logs
- No data being inserted

#### Diagnosis Steps

**Check execution logs in Kestra:**
1. Go to **Executions** tab
2. Click on failed execution
3. Check each task's logs

#### Common Error Messages

**Error: "Connection refused to analytics-postgres"**

**Cause:** PostgreSQL container not running

**Solution:**
```powershell
# Check container status
docker ps | findstr analytics-postgres

# If not running, start it
docker start analytics-postgres

# Wait 10 seconds, then retry workflow
```

---

**Error: "HTTP 429 - Rate limit exceeded"**

**Cause:** Too many requests to Random User API

**Solution:**
```yaml
# Edit workflow, change cron trigger
triggers:
  - id: realtime_schedule
    cron: "*/2 * * * *"  # Change from */1 to */2 (every 2 minutes)
```

---

**Error: "ModuleNotFoundError: No module named 'pandas'"**

**Cause:** Python dependencies not installing

**Solution:**
```yaml
# Verify beforeCommands in workflow
beforeCommands:
  - pip install --no-cache-dir pandas psycopg2-binary sqlalchemy requests
  # Add --no-cache-dir flag
```

---

**Error: "relation 'incoming_users' does not exist"**

**Cause:** Table not created

**Solution:**
1. Check `init_users_table` task completed successfully
2. Manually create table:
```sql
-- Run the CREATE TABLE from workflow YAML
-- Copy from synthetic_users_realtime.yml init_users_table task
```

---

### Issue 3: Dashboard Panels Show Query Errors

#### Symptoms
- Individual panels display "Query error"
- Red error icon in panel corner
- Hover shows SQL error message

#### Diagnosis Steps

**Inspect panel query:**
1. Edit panel (click title → Edit)
2. Check SQL query in query editor
3. Look for error details

#### Common Query Errors

**Error: "column does not exist"**

**Cause:** Table schema mismatch

**Solution:**
```sql
-- Check table structure
\d public.incoming_users

-- Compare with expected columns in dashboard queries
-- Recreate table if needed
```

---

**Error: "syntax error at or near"**

**Cause:** SQL syntax issue in panel query

**Solution:**
1. Copy query from panel
2. Test in PostgreSQL directly:
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics
# Paste query and check error details
```

---

### Issue 4: Dashboard Not Auto-Refreshing

#### Symptoms
- Dashboard shows stale data
- Need to manually refresh browser
- Real-time panels not updating

#### Solutions

**Solution A: Enable auto-refresh**
1. Click refresh dropdown (top-right)
2. Select **5s** interval
3. Verify clock icon is active

**Solution B: Enable live mode**
1. Dashboard settings (gear icon)
2. Go to **JSON Model**
3. Verify: `"liveNow": true`

**Solution C: Check time range**
- Should be set to **Last 30 minutes**
- Not a fixed time range

---

### Issue 5: Profile Pictures Not Displaying

#### Symptoms
- "Latest Users" table shows broken images
- `picture_thumbnail` column blank

#### Diagnosis Steps

**Check data in database:**
```sql
SELECT picture_thumbnail FROM public.incoming_users LIMIT 5;
-- Should show URLs like: https://randomuser.me/api/portraits/...
```

#### Solutions

**Solution A: Configure panel image column**
1. Edit "Latest Users" panel
2. Click **picture_thumbnail** column
3. **Cell options** → **Type** → Select **Image**
4. **Width**: 80
5. Apply changes

**Solution B: Check firewall/proxy**
- Grafana needs internet access to fetch images
- Verify: `curl https://randomuser.me/api/portraits/thumb/women/1.jpg`

---

### Issue 6: Duplicate Users Being Inserted

#### Symptoms
- Same user appears multiple times
- `user_id` not unique
- Count grows faster than expected

#### Diagnosis Steps

**Check for duplicates:**
```sql
SELECT user_id, COUNT(*) 
FROM public.incoming_users 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```

#### Solution

**Verify UPSERT logic in workflow:**
```python
# Should have ON CONFLICT clause
INSERT INTO public.incoming_users (...)
VALUES (...)
ON CONFLICT (user_id) DO UPDATE SET synced_at = CURRENT_TIMESTAMP
```

If missing, update workflow and redeploy.

---

### Issue 7: Slow Dashboard Performance

#### Symptoms
- Panels load slowly (>5 seconds)
- Browser becomes unresponsive
- High CPU usage

#### Solutions

**Solution A: Add database indexes**
```sql
-- Already included in workflow, verify they exist:
\di public.incoming_users*

-- Should show:
-- idx_incoming_users_created_at
-- idx_incoming_users_country
-- idx_incoming_users_gender
```

**Solution B: Limit query ranges**
```sql
-- Add time filters to heavy queries
WHERE created_at >= NOW() - INTERVAL '1 hour'
```

**Solution C: Reduce auto-refresh rate**
- Change from 5s to 10s or 30s

---

### Issue 8: Kestra Workflow Won't Upload

#### Symptoms
- YAML validation errors in Kestra UI
- "Invalid flow definition" message

#### Solutions

**Solution A: Validate YAML syntax**
```powershell
# Use online YAML validator
# Or check indentation in VS Code
```

**Solution B: Check required fields**
```yaml
id: synthetic_users_realtime  # Required
namespace: demo               # Required
tasks:                        # Must have at least one task
  - id: task_name            # Required
    type: ...                # Required
```

**Solution C: Copy-paste issues**
- Ensure no smart quotes (" vs ")
- Verify no hidden characters
- Use plain text editor

---

## 🔧 Advanced Diagnostics

### Full System Health Check

```powershell
# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check Kestra health
curl http://localhost:8090/health

# Check Grafana health
curl http://localhost:3000/api/health

# Check PostgreSQL connection
docker exec analytics-postgres pg_isready -U analytics_user

# Check database size
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT pg_size_pretty(pg_database_size('analytics'));"

# Check table row count
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT COUNT(*) FROM public.incoming_users;"
```

### Reset Everything

```powershell
# Stop workflow in Kestra (pause triggers)

# Drop table
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "DROP TABLE IF EXISTS public.incoming_users;"

# Delete dashboard in Grafana

# Re-upload workflow to Kestra

# Re-import dashboard to Grafana

# Trigger workflow manually
```

---

## 📞 Getting Help

If issues persist:

1. **Check Kestra Logs**: `docker logs kestra --tail 200`
2. **Check PostgreSQL Logs**: `docker logs analytics-postgres --tail 100`
3. **Check Grafana Logs**: `docker logs grafana --tail 100`
4. **Export workflow execution**: Download JSON from failed execution
5. **Export dashboard JSON**: Dashboard settings → JSON Model

Include these logs when seeking help.

---

## 🧪 Verification Scripts

### Test Database Connection
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT version();"
```

### Test Random User API
```powershell
curl "https://randomuser.me/api/?results=1"
```

### Test Grafana Data Source
```powershell
curl -u admin:admin123 http://localhost:3000/api/datasources/uid/P1A0B00DDA2590108
```

### Test Kestra API
```powershell
curl http://localhost:8090/api/v1/flows/demo/synthetic_users_realtime
```
