# Real-time Synthetic User Pipeline - Quick Start

## 🚀 One-Command Setup

This script automates the entire pipeline setup.

## Prerequisites

Before running, ensure:
- ✅ Docker containers are running (Kestra, PostgreSQL, Grafana)
- ✅ You're in the `realtime_users_pipeline` directory
- ✅ Kestra is accessible at http://localhost:8090
- ✅ Grafana is accessible at http://localhost:3000

## Usage

```powershell
.\quick-start.ps1
```

## What It Does

### Step 1: Verify Prerequisites
- Checks Docker containers are running
- Verifies Kestra and Grafana are accessible
- Confirms database connectivity

### Step 2: Deploy Kestra Workflow
- Uploads `synthetic_users_realtime.yml` to Kestra
- Creates namespace `demo` if needed
- Validates workflow syntax

### Step 3: Import Grafana Dashboard
- Imports `realtime_user_analytics.json`
- Configures data source connection
- Sets auto-refresh to 5 seconds

### Step 4: Initialize Pipeline
- Triggers initial workflow execution
- Creates `incoming_users` table
- Loads first batch of users

### Step 5: Verification
- Confirms database table exists
- Checks data is being inserted
- Validates dashboard connectivity

## Expected Output

```
🚀 Real-time User Pipeline - Quick Start
========================================

✅ Step 1: Checking prerequisites...
   - Docker containers: OK
   - Kestra accessible: OK
   - Grafana accessible: OK
   - PostgreSQL accessible: OK

✅ Step 2: Deploying Kestra workflow...
   - Workflow uploaded: demo.synthetic_users_realtime
   - Status: READY

✅ Step 3: Importing Grafana dashboard...
   - Dashboard imported: Real-time User Analytics
   - URL: http://localhost:3000/d/realtime_users_001

✅ Step 4: Initializing pipeline...
   - Workflow triggered
   - Table created: public.incoming_users
   - Initial data loaded: 10 users

✅ Step 5: Verification complete!
   - Database records: 10
   - Dashboard status: Active
   - Auto-refresh: Enabled (5s)

🎉 Setup complete! 

📊 View dashboard: http://localhost:3000/d/realtime_users_001
⚙️  Manage workflow: http://localhost:8090/ui/flows/demo/synthetic_users_realtime

⏱️  Next automatic ingestion: In ~1 minute
```

## Manual Steps (If Script Fails)

### 1. Upload Workflow to Kestra

```powershell
# Navigate to Kestra UI
Start-Process "http://localhost:8090"

# Login: musondaalexander97@gmail.com / Admin1234
# Go to Flows → Create
# Copy content from: kestra/synthetic_users_realtime.yml
# Click Save
```

### 2. Import Dashboard to Grafana

```powershell
# Navigate to Grafana UI
Start-Process "http://localhost:3000"

# Login: admin / admin123
# Dashboards → Import
# Upload: grafana/realtime_user_analytics.json
# Click Import
```

### 3. Trigger Initial Execution

```powershell
# In Kestra UI:
# Navigate to: demo.synthetic_users_realtime
# Click "Execute"
# Set batch_size: 10
# Click "Execute"
```

## Verification Commands

### Check Database
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT COUNT(*) FROM public.incoming_users;"
```

### Check Latest Users
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT first_name, last_name, country, created_at FROM public.incoming_users ORDER BY created_at DESC LIMIT 5;"
```

### Check Workflow Status
```powershell
# Visit: http://localhost:8090/ui/executions
# Should see successful executions every 1 minute
```

### Check Dashboard
```powershell
# Visit: http://localhost:3000/d/realtime_users_001
# All panels should show data
# Time series should show ingestion activity
```

## Troubleshooting

### Script Fails at Step 1
**Issue**: Prerequisites not met

**Solution**:
```powershell
# Check Docker containers
docker ps

# Start missing containers
docker-compose up -d

# Wait 30 seconds for services to start
```

### Script Fails at Step 2
**Issue**: Cannot upload workflow to Kestra

**Solution**:
- Check Kestra logs: `docker logs kestra`
- Verify YAML syntax in `kestra/synthetic_users_realtime.yml`
- Try manual upload via Kestra UI

### Script Fails at Step 3
**Issue**: Cannot import dashboard to Grafana

**Solution**:
- Check Grafana logs: `docker logs grafana`
- Verify JSON syntax in `grafana/realtime_user_analytics.json`
- Check data source UID matches: `P1A0B00DDA2590108`

### Script Fails at Step 4
**Issue**: Workflow execution fails

**Solution**:
- Check execution logs in Kestra UI
- Verify PostgreSQL is running: `docker ps | findstr analytics-postgres`
- Check Random User API: `curl https://randomuser.me/api/?results=1`

### No Data After 5 Minutes
**Issue**: Workflow executed but dashboard shows no data

**Solution**:
```powershell
# Check if data exists
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT COUNT(*) FROM public.incoming_users;"

# If count is 0, check Kestra execution logs
# If count > 0, check Grafana data source connection
```

## Advanced Options

### Customize Batch Size

Edit `kestra/synthetic_users_realtime.yml`:
```yaml
triggers:
  - id: realtime_schedule
    inputs:
      batch_size: 20  # Change from 10 to 20
```

### Change Ingestion Frequency

Edit `kestra/synthetic_users_realtime.yml`:
```yaml
triggers:
  - id: realtime_schedule
    cron: "*/2 * * * *"  # Change to every 2 minutes
```

### Adjust Dashboard Refresh

In Grafana:
1. Open dashboard
2. Click refresh dropdown (top-right)
3. Select desired interval (5s, 10s, 30s, 1m)

## Next Steps

1. **Monitor Pipeline**: Watch executions in Kestra for 5-10 minutes
2. **Explore Dashboard**: Check all 10 panels are populating
3. **Customize**: Modify workflow or dashboard to your needs
4. **Scale**: Increase batch size or frequency as needed

## Additional Resources

- 📖 **Setup Guide**: `docs/SETUP_GUIDE.md`
- 🔧 **Troubleshooting**: `docs/TROUBLESHOOTING.md`
- 📡 **API Reference**: `docs/API_REFERENCE.md`

## Support

If you encounter issues:
1. Check `docs/TROUBLESHOOTING.md`
2. Review Kestra execution logs
3. Check PostgreSQL and Grafana logs
4. Verify all Docker containers are healthy

---

**Ready? Run the script:**

```powershell
.\quick-start.ps1
```
