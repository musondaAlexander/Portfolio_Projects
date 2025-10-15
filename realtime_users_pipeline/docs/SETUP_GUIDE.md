# Real-time Synthetic User Pipeline - Setup Guide

## 🎯 Overview

This pipeline ingests synthetic user data from the Random User API and visualizes it in real-time using Grafana. Perfect for testing Kestra ETL capabilities with continuous data streams.

## 📋 Prerequisites

- Docker Compose running with Kestra, PostgreSQL, and Grafana
- Kestra accessible at http://localhost:8090
- Grafana accessible at http://localhost:3000
- Analytics PostgreSQL database (analytics-postgres)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

Run the quick start script from the `realtime_users_pipeline` directory:

```powershell
.\quick-start.ps1
```

This script will:
1. Upload the workflow to Kestra
2. Import the dashboard to Grafana
3. Trigger the initial workflow execution
4. Verify the setup

### Option 2: Manual Setup

#### Step 1: Deploy Kestra Workflow

1. Navigate to Kestra UI: http://localhost:8090
2. Login with: `musondaalexander97@gmail.com` / `Admin1234`
3. Go to **Flows** → **Create**
4. Copy content from `kestra/synthetic_users_realtime.yml`
5. Click **Save**

#### Step 2: Import Grafana Dashboard

1. Navigate to Grafana: http://localhost:3000
2. Login with: `admin` / `admin123`
3. Go to **Dashboards** → **Import**
4. Click **Upload JSON file**
5. Select `grafana/realtime_user_analytics.json`
6. Click **Import**

#### Step 3: Start the Pipeline

In Kestra:
1. Navigate to your workflow: `demo.synthetic_users_realtime`
2. Click **Execute**
3. Set `batch_size` to `10` (or leave default)
4. Click **Execute**

## 📊 What to Expect

### Workflow Behavior

- **Automated Execution**: Runs every 1 minute via cron trigger
- **Batch Size**: 10 users per execution (configurable)
- **API Source**: Random User API (https://randomuser.me/api/)
- **Data Storage**: PostgreSQL table `public.incoming_users`

### Dashboard Features

The dashboard includes 10 real-time panels:

1. **Total Users Ingested** - Cumulative count
2. **Users Last Minute** - Recent ingestion rate
3. **Unique Countries** - Geographic diversity
4. **Average Age** - User age metrics
5. **Real-time Ingestion Rate** - 30-minute time series
6. **Gender Distribution** - Donut chart
7. **Top 10 Countries** - Pie chart
8. **Latest Users** - Table with profile pictures
9. **Users by Nationality** - Aggregated table
10. **Age Distribution** - Bar chart by age groups

### Auto-Refresh

- Dashboard refreshes every **5 seconds**
- Live mode enabled for real-time updates
- Time range: Last 30 minutes

## 🔍 Monitoring

### Check Workflow Status

```powershell
# View Kestra logs
docker logs kestra -f
```

### Check Database

```powershell
# Connect to PostgreSQL
docker exec -it analytics-postgres psql -U analytics_user -d analytics

# Query user count
SELECT COUNT(*) FROM public.incoming_users;

# View latest users
SELECT first_name, last_name, country, created_at 
FROM public.incoming_users 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Dashboard Data

In Grafana:
1. Open **Real-time User Analytics** dashboard
2. Check panel titles show data (not "No data")
3. Verify time series shows ingestion activity
4. Check latest users table has profile pictures

## ⚙️ Configuration

### Adjust Ingestion Frequency

Edit the workflow trigger in Kestra:

```yaml
triggers:
  - id: realtime_schedule
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "*/5 * * * *"  # Change to every 5 minutes
    inputs:
      batch_size: 20     # Increase batch size
```

### Adjust Dashboard Refresh Rate

In Grafana dashboard settings:
1. Click **Dashboard settings** (gear icon)
2. Go to **General** tab
3. Change **Auto refresh** to desired interval

## 🛠️ Troubleshooting

### No Data in Dashboard

**Check 1: Workflow Running**
```powershell
# Check if workflow executed successfully
# Visit: http://localhost:8090/ui/executions
```

**Check 2: Database Has Data**
```sql
SELECT COUNT(*) FROM public.incoming_users;
-- Should return > 0
```

**Check 3: Grafana Data Source**
- Verify data source: **Analytics PostgreSQL**
- UID: `P1A0B00DDA2590108`
- Test connection in Grafana settings

### Workflow Fails

**Check Kestra Logs:**
```powershell
docker logs kestra --tail 100
```

**Common Issues:**
- **API rate limit**: Random User API allows 100 req/min
- **Database connection**: Verify analytics-postgres container is running
- **Python dependencies**: Check if pandas, psycopg2-binary installed

### Dashboard Shows Errors

**Panel Error: "Query error"**
- Check PostgreSQL query syntax
- Verify table `incoming_users` exists
- Check data source connection

**Panel Error: "No data"**
- Wait 1-2 minutes for first execution
- Check time range (should be "Last 30 minutes")
- Verify auto-refresh is enabled

## 📈 Scaling Considerations

### API Rate Limits

Random User API free tier:
- **Limit**: 100 requests per minute
- **Current usage**: 1 request per minute (10 users)
- **Safe scaling**: Up to 100 requests per minute

### Database Performance

Current indexes:
- `idx_incoming_users_created_at` (DESC)
- `idx_incoming_users_country`
- `idx_incoming_users_gender`

For high-volume scenarios (>1M records):
- Add composite indexes for frequently filtered columns
- Consider partitioning by created_at
- Implement data retention policy

### Grafana Performance

- Dashboard queries optimized for time-based filtering
- Consider materialized views for aggregations
- Use query caching for heavy panels

## 🔒 Security Notes

- Random User API requires no authentication (public data)
- PostgreSQL credentials stored in Kestra workflow
- Consider using Kestra secrets management for production
- Dashboard accessible to all Grafana users

## 📚 Additional Resources

- [Kestra Documentation](https://kestra.io/docs)
- [Random User API Docs](https://randomuser.me/documentation)
- [Grafana Panel Documentation](https://grafana.com/docs/grafana/latest/panels/)
- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)

## 🎓 Learning Exercises

1. **Modify API Parameters**: Add more fields like `picture`, `id`
2. **Create Custom Panels**: Add nationality heatmap
3. **Implement Alerts**: Notify when ingestion rate drops
4. **Add Data Quality Checks**: Validate email formats, phone numbers
5. **Build Aggregation Tables**: Create hourly/daily summaries

## 📝 Notes

- This is a **demo pipeline** for testing purposes
- Data is synthetic and not real user information
- Use for load testing, dashboard prototyping, and ETL validation
- Safe to run continuously without privacy concerns
