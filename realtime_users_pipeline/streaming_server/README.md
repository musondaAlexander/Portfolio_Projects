# WebSocket Streaming Server

Real-time user data streaming using WebSockets for continuous data flow.

## 🎯 Overview

This implementation converts the batch-based pipeline into a **true streaming pipeline** using WebSockets:

```
Random User API → WebSocket Server → WebSocket Client → PostgreSQL → Grafana
         (1/sec)        (8765)        (real-time)      (instant)    (1s refresh)
```

## 🚀 Quick Start

### 1. Install Dependencies

```powershell
cd streaming_server
pip install -r requirements.txt
```

### 2. Start WebSocket Server

```powershell
python websocket_server.py
```

**Expected output:**
```
============================================================
🌐 Real-time User Data Streaming Server
============================================================
📍 WebSocket URL: ws://localhost:8765
📡 Stream rate: 1 user/second
🔗 API source: https://randomuser.me/api/
============================================================
✅ Server started successfully!
🚀 Starting user stream...
```

### 3. Start Consumer (in new terminal)

```powershell
python websocket_client.py
```

**Expected output:**
```
============================================================
🎧 Real-time User Data Consumer
============================================================
🔗 Connecting to: ws://localhost:8765
💾 Database: localhost:5433/analytics
============================================================
✅ Connected to user stream!
👋 Connected to real-time user stream
✅ #1 (Stream #1): John Smith from United States
✅ #2 (Stream #2): Maria Garcia from Spain
...
```

### 4. View in Grafana

```powershell
# Dashboard will show continuous real-time updates
http://localhost:3000/d/realtime_users_001
```

Set dashboard refresh to **1 second** for smoothest experience.

## 📊 Architecture

### Components

1. **WebSocket Server** (`websocket_server.py`)
   - Fetches users from Random User API
   - Broadcasts to all connected clients
   - Handles multiple client connections
   - Rate limiting: 1 user/second

2. **WebSocket Client** (`websocket_client.py`)
   - Connects to WebSocket server
   - Receives real-time user stream
   - Inserts into PostgreSQL
   - Auto-reconnects on disconnect

### Data Flow

```
┌─────────────────┐
│  Random User    │  1 request/sec
│      API        │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   WebSocket     │  Port 8765
│     Server      │  Broadcast
└────────┬────────┘
         │ ws://
         ▼
┌─────────────────┐
│   WebSocket     │  Real-time
│     Client      │  Consumer
└────────┬────────┘
         │ SQL
         ▼
┌─────────────────┐
│   PostgreSQL    │  Instant writes
│    Database     │
└────────┬────────┘
         │ Query
         ▼
┌─────────────────┐
│    Grafana      │  1-second refresh
│   Dashboard     │
└─────────────────┘
```

## ⚙️ Configuration

### Server Settings

In `websocket_server.py`:

```python
# Port configuration
PORT = 8765

# Stream rate (seconds between users)
STREAM_DELAY = 1  # 1 user/second = 3600/hour

# API configuration
API_URL = 'https://randomuser.me/api/'
```

### Client Settings

In `websocket_client.py`:

```python
# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'analytics',
    'user': 'analytics_user',
    'password': 'analytics_pass'
}

# WebSocket server
SERVER_URI = "ws://localhost:8765"
```

## 📈 Performance

### Throughput

- **Rate**: 1 user/second
- **Hourly**: 3,600 users
- **Daily**: 86,400 users
- **API usage**: 3,600 requests/hour (well within 6,000/hour limit)

### Latency

- **API → Server**: ~100-300ms
- **Server → Client**: <10ms (local)
- **Client → Database**: ~20-50ms
- **Total end-to-end**: <500ms

### Scalability

- **Multiple clients**: Supported (broadcast to all)
- **Concurrent connections**: Limited by system resources
- **Backpressure**: Clients buffer internally

## 🔍 Monitoring

### Server Logs

```
2024-01-15 10:30:15 - INFO - 📡 Broadcast #123: Jane Doe (Canada) to 2 clients
2024-01-15 10:30:16 - INFO - 📡 Broadcast #124: John Smith (US) to 2 clients
2024-01-15 10:31:00 - INFO - 📊 Stats: 184 users streamed, 2 active clients, ~3.1 users/min
```

### Client Logs

```
2024-01-15 10:30:15 - INFO - ✅ #45 (Stream #123): Jane Doe from Canada
2024-01-15 10:30:16 - INFO - ✅ #46 (Stream #124): John Smith from United States
2024-01-15 10:31:00 - INFO - 📊 Milestone: 60 users inserted!
```

### Database Monitoring

```sql
-- Check latest users
SELECT first_name, last_name, country, created_at 
FROM public.incoming_users 
ORDER BY created_at DESC 
LIMIT 10;

-- Check ingestion rate (last minute)
SELECT COUNT(*) 
FROM public.incoming_users 
WHERE created_at >= NOW() - INTERVAL '1 minute';
```

## 🛠️ Troubleshooting

### Server won't start

**Error: "Address already in use"**
```powershell
# Find process using port 8765
netstat -ano | findstr :8765

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### Client can't connect

**Error: "Connection refused"**
- Verify server is running
- Check firewall settings
- Confirm port 8765 is accessible

### Database connection fails

**Error: "Could not connect to server"**
```powershell
# Verify PostgreSQL is running
docker ps | findstr analytics-postgres

# Test connection
docker exec -it analytics-postgres psql -U analytics_user -d analytics -c "SELECT 1;"
```

### No data in Grafana

- Check client is inserting data (see logs)
- Verify database has recent data
- Set dashboard time range to "Last 5 minutes"
- Ensure auto-refresh is enabled (1 second)

## 🎓 Advanced Features

### Run Server in Background

```powershell
# Windows (using pythonw)
start /b pythonw websocket_server.py

# Or use nohup equivalent
Start-Process python -ArgumentList "websocket_server.py" -WindowStyle Hidden
```

### Run as Docker Container

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY websocket_server.py .
EXPOSE 8765

CMD ["python", "websocket_server.py"]
```

```powershell
# Build
docker build -t user-stream-server .

# Run
docker run -d -p 8765:8765 --network intelligence_center_demo_default user-stream-server
```

### Multiple Consumers

You can run multiple clients for redundancy or load distribution:

```powershell
# Terminal 1
python websocket_client.py

# Terminal 2
python websocket_client.py  # Will receive same stream
```

Both will insert to database (upsert handles duplicates).

## 📊 Comparison with Original

| Metric | Original (Batch) | WebSocket Streaming |
|--------|-----------------|---------------------|
| **Latency** | 60 seconds | <1 second |
| **Data flow** | Intermittent | Continuous |
| **Architecture** | Pull (cron) | Push (WebSocket) |
| **Throughput** | 600/hour | 3,600/hour |
| **Complexity** | Low | Medium |
| **Real-time** | No | Yes ✅ |

## 🔒 Security Considerations

### Production Deployment

For production, add:

1. **Authentication**
```python
# Server: Verify client tokens
# Client: Send auth header
```

2. **TLS/SSL**
```python
# Use wss:// instead of ws://
```

3. **Rate Limiting**
```python
# Limit connections per IP
# Throttle message rate
```

4. **Environment Variables**
```python
import os
DB_PASSWORD = os.getenv('DB_PASSWORD')
```

## 📚 Resources

- **WebSockets Docs**: https://websockets.readthedocs.io/
- **aiohttp**: https://docs.aiohttp.org/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **Random User API**: https://randomuser.me/documentation

## 🎯 Next Steps

1. ✅ **Test the streaming** - Run server + client
2. ✅ **View in Grafana** - See real-time updates
3. ✅ **Monitor performance** - Check logs and metrics
4. 🚀 **Scale up** - Add more consumers or increase rate
5. 🎨 **Customize** - Modify for your use case

---

**Built for true real-time streaming! 🚀**
