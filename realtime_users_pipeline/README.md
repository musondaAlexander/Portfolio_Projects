# Real-time Synthetic User Data Pipeline

[![Kestra](https://img.shields.io/badge/Kestra-Workflow-blue)](http://localhost:8090)
[![Grafana](https://img.shields.io/badge/Grafana-Dashboard-orange)](http://localhost:3000)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)](https://www.postgresql.org/)
[![Random User API](https://img.shields.io/badge/API-Random_User-green)](https://randomuser.me/)

A complete real-time ETL pipeline that ingests synthetic user data from the Random User API, stores it in PostgreSQL, and visualizes it with Grafana dashboards. Perfect for testing Kestra workflows, prototyping dashboards, and load testing data pipelines.

## 🎯 Features

- ⚡ **Real-time Ingestion**: New users every minute via Kestra scheduled workflows
- 📊 **Live Dashboard**: 10-panel Grafana dashboard with 5-second auto-refresh
- 🔄 **Automated ETL**: End-to-end pipeline from API → Database → Visualization
- 🌍 **Rich Demographics**: 25+ user attributes including location, age, gender, pictures
- 🧪 **Synthetic Data**: Safe for testing - no real user information
- 📈 **Scalable**: Handles from 1 to 1000+ users per minute

## 📸 Dashboard Preview

The dashboard includes:
- **KPI Cards**: Total users, ingestion rate, countries, average age
- **Time Series**: Real-time ingestion activity over 30 minutes
- **Charts**: Gender distribution, top countries, age groups
- **Tables**: Latest users with profile pictures, nationality breakdown

## 🏗️ Architecture

```
┌─────────────────┐
│  Random User    │
│      API        │──┐
└─────────────────┘  │
                     │ HTTPS GET
                     ▼
              ┌─────────────┐
              │   Kestra    │
              │  Workflow   │
              └─────────────┘
                     │ Python ETL
                     ▼
              ┌─────────────┐
              │ PostgreSQL  │
              │  Database   │
              └─────────────┘
                     │ SQL Queries
                     ▼
              ┌─────────────┐
              │   Grafana   │
              │  Dashboard  │
              └─────────────┘
```

## 📋 Prerequisites

- Docker & Docker Compose
- Kestra running at `http://localhost:8090`
- Grafana running at `http://localhost:3000`
- PostgreSQL (`analytics-postgres`) accessible on port 5433

## 🚀 Quick Start

### One-Command Setup

```powershell
cd realtime_users_pipeline
.\quick-start.ps1
```

Follow the interactive prompts to:
1. ✅ Verify prerequisites
2. 📤 Upload Kestra workflow
3. 📊 Import Grafana dashboard
4. ▶️ Start ingestion
5. ✔️ Verify setup

### Manual Setup

**1. Deploy Kestra Workflow**

```powershell
# Open Kestra UI
http://localhost:8090

# Login: musondaalexander97@gmail.com / Admin1234
# Navigate to: Flows → Create
# Copy content from: kestra/synthetic_users_realtime.yml
# Click: Save
```

**2. Import Grafana Dashboard**

```powershell
# Open Grafana UI
http://localhost:3000

# Login: admin / admin123
# Navigate to: Dashboards → Import
# Upload: grafana/realtime_user_analytics.json
# Click: Import
```

**3. Trigger Initial Execution**

```powershell
# In Kestra UI
# Navigate to: demo.synthetic_users_realtime
# Click: Execute
# Set batch_size: 10
# Click: Execute
```

**4. View Dashboard**

```powershell
# Open in browser
http://localhost:3000/d/realtime_users_001
```

## 📊 Dashboard Panels

| Panel | Type | Description |
|-------|------|-------------|
| Total Users | Stat | Cumulative count of all users |
| Users Last Minute | Stat | Recent ingestion rate |
| Unique Countries | Stat | Geographic diversity metric |
| Average Age | Stat | Mean age across all users |
| Real-time Ingestion Rate | Time Series | Users per minute over 30 min |
| Gender Distribution | Donut Chart | Male vs Female ratio |
| Top 10 Countries | Pie Chart | Most common countries |
| Latest Users | Table | 50 most recent with pictures |
| Users by Nationality | Table | Aggregated by country code |
| Age Distribution | Bar Chart | Users grouped by age ranges |

## ⚙️ Configuration

### Workflow Settings

Located in `kestra/synthetic_users_realtime.yml`:

```yaml
# Change ingestion frequency
triggers:
  - id: realtime_schedule
    cron: "*/1 * * * *"  # Every 1 minute (default)
    # Examples:
    # "*/2 * * * *"  # Every 2 minutes
    # "*/5 * * * *"  # Every 5 minutes
    # "0 * * * *"    # Every hour
    
# Change batch size
inputs:
  - id: batch_size
    type: INT
    defaults: 10  # Users per batch (default)
    # Recommended: 5-50 for testing, up to 5000 max
```

### Dashboard Settings

- **Auto-refresh**: 5 seconds (configurable in dashboard settings)
- **Time range**: Last 30 minutes
- **Live mode**: Enabled by default

## 🗄️ Database Schema

Table: `public.incoming_users`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | VARCHAR(100) | Primary key (UUID from API) |
| `gender` | VARCHAR(20) | Male/Female |
| `title` | VARCHAR(20) | Mr, Mrs, Miss, Ms, etc |
| `first_name` | VARCHAR(100) | Given name |
| `last_name` | VARCHAR(100) | Family name |
| `email` | VARCHAR(255) | Email address |
| `username` | VARCHAR(100) | Login username |
| `date_of_birth` | TIMESTAMP | Birth date |
| `age` | INT | Calculated age |
| `phone` | VARCHAR(50) | Phone number |
| `cell` | VARCHAR(50) | Mobile number |
| `street_number` | VARCHAR(20) | Street number |
| `street_name` | VARCHAR(255) | Street name |
| `city` | VARCHAR(100) | City |
| `state` | VARCHAR(100) | State/Province |
| `country` | VARCHAR(100) | Country name |
| `postcode` | VARCHAR(20) | Postal code |
| `latitude` | VARCHAR(50) | GPS latitude |
| `longitude` | VARCHAR(50) | GPS longitude |
| `timezone_offset` | VARCHAR(20) | UTC offset |
| `timezone_description` | VARCHAR(255) | Timezone name |
| `nationality` | VARCHAR(10) | Country code (US, GB, etc) |
| `picture_large` | TEXT | Profile picture URL (large) |
| `picture_medium` | TEXT | Profile picture URL (medium) |
| `picture_thumbnail` | TEXT | Profile picture URL (thumbnail) |
| `registered_date` | TIMESTAMP | Account registration date |
| `registered_age` | INT | Years since registration |
| `created_at` | TIMESTAMP | Insert timestamp |
| `synced_at` | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_incoming_users_created_at` on `created_at DESC`
- `idx_incoming_users_country` on `country`
- `idx_incoming_users_gender` on `gender`

## 🔍 Monitoring & Verification

### Check Workflow Executions

```powershell
# View Kestra execution history
http://localhost:8090/ui/executions

# Check Kestra logs
docker logs kestra -f
```

### Query Database

```powershell
# Connect to PostgreSQL
docker exec -it analytics-postgres psql -U analytics_user -d analytics

# Check user count
SELECT COUNT(*) FROM public.incoming_users;

# View latest 10 users
SELECT first_name, last_name, country, created_at 
FROM public.incoming_users 
ORDER BY created_at DESC 
LIMIT 10;

# Check ingestion rate
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as users
FROM public.incoming_users
WHERE created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
```

### Verify Dashboard

```powershell
# Open dashboard
http://localhost:3000/d/realtime_users_001

# Check:
# - All panels show data (not "No data")
# - Time series shows activity
# - Latest users table has profile pictures
# - Auto-refresh icon is spinning
```

## 🛠️ Troubleshooting

### No Data in Dashboard

**Check 1**: Verify workflow executed
```powershell
# Check Kestra executions
http://localhost:8090/ui/executions
# Look for green "SUCCESS" status
```

**Check 2**: Verify database has data
```powershell
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT COUNT(*) FROM public.incoming_users;"
```

**Check 3**: Test Grafana data source
```powershell
# In Grafana: Configuration → Data sources → Analytics PostgreSQL → Test
# Should show: "Database Connection OK"
```

### Workflow Fails

**Check logs:**
```powershell
docker logs kestra --tail 100
```

**Common issues:**
- **API rate limit**: Reduce frequency or batch size
- **Database connection**: Verify `analytics-postgres` container is running
- **Python errors**: Check dependencies installed in workflow

### More Help

See detailed troubleshooting guide: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)

## 📚 Documentation

- **[Setup Guide](docs/SETUP_GUIDE.md)**: Comprehensive installation and configuration
- **[Quick Start](docs/QUICK_START.md)**: Fast-track setup instructions  
- **[Troubleshooting](docs/TROUBLESHOOTING.md)**: Common issues and solutions
- **[API Reference](docs/API_REFERENCE.md)**: Random User API documentation

## 📈 Performance & Scaling

### Current Configuration

- **Frequency**: 1 execution per minute
- **Batch Size**: 10 users per execution
- **Throughput**: ~600 users/hour, ~14,400 users/day
- **API Usage**: 1 request/min (well within 100 req/min limit)

### Scaling Options

| Scenario | Frequency | Batch Size | Throughput | Safe? |
|----------|-----------|------------|------------|-------|
| Light | Every 5 min | 5 users | ~1,440/day | ✅ |
| Normal | Every 1 min | 10 users | ~14,400/day | ✅ |
| Heavy | Every 1 min | 50 users | ~72,000/day | ✅ |
| Aggressive | Every 30 sec | 100 users | ~288,000/day | ⚠️ |

### Database Performance

- Table size: ~2 KB per user
- 10K users: ~20 MB
- 100K users: ~200 MB
- 1M users: ~2 GB

Indexes ensure fast queries even at 1M+ records.

## � Data Streaming Support

### Current Setup: Batch Processing
- **Mode**: Scheduled batch ingestion (every 1 minute)
- **Latency**: 60-second intervals
- **Architecture**: Pull-based (cron trigger)

### ⚡ Upgrade to True Streaming
This pipeline **can be enhanced for real-time streaming**! See **[STREAMING_ENHANCEMENTS.md](STREAMING_ENHANCEMENTS.md)** for:

- **Option 1: Micro-batching** (10-second intervals) - Quick config change
- **Option 2: Kafka Streaming** - Production-grade event streaming
- **Option 3: WebSocket Streaming** - True real-time (<1s latency) ⭐ **Ready to use!**

#### 🚀 Quick Start with WebSocket Streaming

```powershell
# Install dependencies
cd streaming_server
pip install -r requirements.txt

# Start streaming server (Terminal 1)
python websocket_server.py

# Start consumer (Terminal 2)
python websocket_client.py

# View in Grafana (set refresh to 1 second)
http://localhost:3000/d/realtime_users_001
```

**Result**: Continuous real-time data flow at 1 user/second (3,600/hour)

See **[streaming_server/README.md](streaming_server/README.md)** for full documentation.

---

## �🎓 Use Cases

- ✅ **ETL Testing**: Validate Kestra workflow patterns
- ✅ **Dashboard Prototyping**: Design Grafana panels with realistic data
- ✅ **Load Testing**: Stress-test database and visualization layers
- ✅ **Training**: Learn Kestra, Grafana, PostgreSQL integration
- ✅ **Demos**: Show real-time data pipelines to stakeholders
- ✅ **Development**: Test new features with continuous data flow
- ✅ **Streaming Pipelines**: Learn real-time data streaming architectures ⭐ NEW!

## 🔒 Security & Privacy

- **Synthetic Data**: All users are AI-generated, not real people
- **No Authentication**: Random User API requires no API key
- **Safe for Public**: No sensitive or private information
- **GDPR Compliant**: No actual personal data processed

## 🤝 Contributing

This is a demo project. Feel free to:
- Modify workflows for your use case
- Add new dashboard panels
- Extend the data model
- Integrate additional APIs

## 📝 License

This project uses:
- **Kestra**: Apache License 2.0
- **Grafana**: AGPLv3
- **PostgreSQL**: PostgreSQL License
- **Random User API**: MIT License

## 🙏 Acknowledgments

- [Random User API](https://randomuser.me/) for providing free synthetic user data
- [Kestra](https://kestra.io/) for the powerful workflow orchestration
- [Grafana](https://grafana.com/) for the beautiful visualization platform
- [PostgreSQL](https://www.postgresql.org/) for the robust database

## 📞 Support

Having issues? Check:
1. [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Kestra execution logs
3. PostgreSQL connection
4. Grafana data source settings

---

**Built with ❤️ for testing and learning**

🚀 Start ingesting users now: `.\quick-start.ps1`
