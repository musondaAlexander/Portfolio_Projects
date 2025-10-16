# Setup Guide

## Prerequisites

- Docker Desktop installed and running
- At least 8GB RAM available
- Ports available: 3000, 6041, 8080, 8090, 9000, 9092, 2181

## Installation Steps

### 1. Clone and Navigate

```powershell
cd c:\Users\User\Documents\vscode_projects\intelligence_center_demo\Portfolio_Projects\kafka-kestra
```

### 2. Start All Services

```powershell
docker-compose up -d
```

This will start 11 containers:
- Kafka & Zookeeper (message broker)
- TDengine (time-series database)
- Grafana (visualization)
- Kestra (workflow orchestration)
- PostgreSQL (Kestra backend)
- 3x Solar Farm Producers (data generators)
- 1x Consumer (Kafka → TDengine)
- Kafka UI (monitoring)

### 3. Verify Containers

```powershell
docker-compose ps
```

All 11 containers should show status "Up".

### 4. Configure TDengine Datasource in Grafana

**Important**: The datasource must be created manually due to password encryption requirements.

1. Open Grafana: http://localhost:3000
2. Login with: `admin` / `admin123`
3. Navigate to: **Connections → Data sources → Add new data source**
4. Search for "TDengine" and select it
5. Configure:
   - **URL**: `http://tdengine:6041`
   - **User**: `root`
   - **Password**: `taosdata`
6. Click **Save & test** (should show green "Data source is working")

### 5. Access Dashboards

1. Navigate to: **Dashboards** in the left sidebar
2. Open: **Solar Farm Data**
3. You should see 6 panels with live data:
   - Average Power Output (time-series chart)
   - Total Power Output (gauge)
   - Energy Generated (stat)
   - Ambient Temperature (time-series chart)
   - Wind Speed (time-series chart)
   - Farm Summary (table)

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / admin123 |
| Kestra | http://localhost:8090 | admin@solar.com / Admin1234 |
| Kafka UI | http://localhost:8080 | - |
| TDengine REST | http://localhost:6041 | root / taosdata |

## Verification Commands

### Check TDengine Data

```powershell
docker exec -it tdengine taos -s "SELECT COUNT(*) FROM renewables.solarfarms;"
```

Should show 20,000+ records and growing.

### View Recent Data

```powershell
docker exec -it tdengine taos -s "SELECT * FROM renewables.solarfarms ORDER BY ts DESC LIMIT 5;"
```

### Check Kafka Topics

Visit http://localhost:8080 and navigate to Topics. You should see:
- `solarfarma-metrics`
- `solafarmb-metrics`
- `solarfarmc-metrics`

Each topic should show messages arriving every 10 seconds.

## Data Flow

1. **Producers** generate simulated solar farm metrics every 10 seconds
2. **Kafka** buffers messages across 3 topics
3. **Consumer** reads from all topics and writes to TDengine
4. **TDengine** stores time-series data in `renewables.solarfarms` table
5. **Grafana** queries TDengine every 5 seconds and updates dashboards
6. **Kestra** (optional) can orchestrate data pipelines and workflows

## Troubleshooting

If dashboards show "No Data", see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## Stopping the Platform

```powershell
# Stop all containers
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```

## Next Steps

- Customize dashboard panels in Grafana
- Create Kestra workflows for data processing
- Add new solar farm producers
- Configure alerting rules in Grafana
- Export data from TDengine for analysis
