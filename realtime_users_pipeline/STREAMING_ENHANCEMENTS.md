# Streaming Enhancements for Real-time User Pipeline

## 🎯 Current State vs True Streaming

### Current Architecture (Batch Processing)
```
Every 1 minute:
API → Kestra (10 users) → PostgreSQL → Grafana (5s refresh)
```

**Characteristics:**
- ❌ 60-second gaps between ingestions
- ❌ Pull-based (polling)
- ✅ Simple to maintain
- ✅ Low API usage

### True Streaming Architecture
```
Continuous:
API → Stream Processor → Message Queue → Consumer → PostgreSQL → Grafana (1s refresh)
```

**Characteristics:**
- ✅ Continuous data flow
- ✅ Push-based (reactive)
- ⚠️ More complex infrastructure
- ⚠️ Higher resource usage

---

## 🚀 Enhancement Options

### Option 1: Near Real-Time (Micro-Batching) ⭐ RECOMMENDED

**Best for**: Testing, prototyping, learning

**Changes Required**: Minimal (just configuration)

**Implementation**:

1. **Update Kestra workflow trigger** to run every 10 seconds:
```yaml
triggers:
  - id: near_realtime_schedule
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "*/10 * * * * *"  # Every 10 seconds (note: 6 fields for seconds)
    inputs:
      batch_size: 2  # Smaller batches for smoother flow
```

2. **Update Grafana dashboard refresh** to 1 second:
   - Dashboard Settings → Auto-refresh → 1s

**Pros:**
- ✅ Easy to implement (just config changes)
- ✅ Uses existing infrastructure
- ✅ Reduces latency from 60s to 10s
- ✅ No new dependencies

**Cons:**
- ❌ Still has micro-gaps (10s)
- ❌ Not truly continuous
- ❌ Higher API usage (6x current)

**Expected Throughput:**
- 2 users every 10 seconds = 12 users/min = 720 users/hour = 17,280 users/day

---

### Option 2: Apache Kafka Streaming ⭐⭐ PRODUCTION-GRADE

**Best for**: Production, scalability, high-throughput

**Architecture**:
```
Random User API → Kestra Producer → Kafka Topic → Kafka Consumer → PostgreSQL → Grafana
```

**New Components Needed**:
- Apache Kafka (message broker)
- Zookeeper (Kafka dependency)
- Kafka Connect (PostgreSQL sink)

**Implementation Steps**:

#### 1. Add Kafka to Docker Compose

Create `docker-compose.kafka.yml`:
```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    networks:
      - intelligence_center_demo_default

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    networks:
      - intelligence_center_demo_default

  kafka-connect:
    image: confluentinc/cp-kafka-connect:7.5.0
    depends_on:
      - kafka
      - analytics-postgres
    ports:
      - "8083:8083"
    environment:
      CONNECT_BOOTSTRAP_SERVERS: kafka:29092
      CONNECT_REST_PORT: 8083
      CONNECT_GROUP_ID: kafka-connect-group
      CONNECT_CONFIG_STORAGE_TOPIC: _connect-configs
      CONNECT_OFFSET_STORAGE_TOPIC: _connect-offsets
      CONNECT_STATUS_STORAGE_TOPIC: _connect-status
      CONNECT_KEY_CONVERTER: org.apache.kafka.connect.json.JsonConverter
      CONNECT_VALUE_CONVERTER: org.apache.kafka.connect.json.JsonConverter
      CONNECT_REST_ADVERTISED_HOST_NAME: kafka-connect
      CONNECT_PLUGIN_PATH: /usr/share/java,/usr/share/confluent-hub-components
    networks:
      - intelligence_center_demo_default

networks:
  intelligence_center_demo_default:
    external: true
```

#### 2. Create Kafka Producer Workflow

`kestra/kafka_streaming_users.yml`:
```yaml
id: kafka_streaming_users
namespace: demo

description: Stream users to Kafka for real-time processing

inputs:
  - id: stream_duration_minutes
    type: INT
    defaults: 60
    description: How long to stream (in minutes)

tasks:
  - id: stream_to_kafka
    type: io.kestra.plugin.scripts.python.Script
    containerImage: python:3.11-slim
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      networkMode: intelligence_center_demo_default
    beforeCommands:
      - pip install kafka-python requests
    script: |
      from kafka import KafkaProducer
      import requests
      import json
      import time
      from datetime import datetime, timedelta
      
      # Initialize Kafka producer
      producer = KafkaProducer(
          bootstrap_servers=['kafka:29092'],
          value_serializer=lambda v: json.dumps(v).encode('utf-8')
      )
      
      print("🚀 Starting continuous user stream to Kafka...")
      
      duration = {{ inputs.stream_duration_minutes }}
      end_time = datetime.now() + timedelta(minutes=duration)
      users_streamed = 0
      
      while datetime.now() < end_time:
          try:
              # Fetch 1 user
              response = requests.get(
                  'https://randomuser.me/api/?results=1&inc=gender,name,email,login,dob,registered,phone,cell,picture,location,nat'
              )
              
              if response.status_code == 200:
                  data = response.json()
                  user = data['results'][0]
                  
                  # Send to Kafka topic
                  producer.send('users-stream', value=user)
                  producer.flush()
                  
                  users_streamed += 1
                  print(f"✅ Streamed user #{users_streamed}: {user['name']['first']} {user['name']['last']}")
                  
                  # Sleep to avoid rate limiting (1 user per second = 3600/hour)
                  time.sleep(1)
              else:
                  print(f"❌ API error: {response.status_code}")
                  time.sleep(5)
                  
          except Exception as e:
              print(f"⚠️ Error: {str(e)}")
              time.sleep(5)
      
      producer.close()
      print(f"🎯 Streaming complete! Total users: {users_streamed}")

triggers:
  - id: continuous_stream
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "0 * * * *"  # Start new stream every hour
    inputs:
      stream_duration_minutes: 60
```

#### 3. Create Kafka Consumer Workflow

`kestra/kafka_consumer_to_postgres.yml`:
```yaml
id: kafka_consumer_to_postgres
namespace: demo

description: Consume users from Kafka and load to PostgreSQL

tasks:
  - id: consume_from_kafka
    type: io.kestra.plugin.scripts.python.Script
    containerImage: python:3.11-slim
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      networkMode: intelligence_center_demo_default
    beforeCommands:
      - pip install kafka-python psycopg2-binary sqlalchemy
    script: |
      from kafka import KafkaConsumer
      import json
      from sqlalchemy import create_engine, text
      from datetime import datetime
      
      # Initialize Kafka consumer
      consumer = KafkaConsumer(
          'users-stream',
          bootstrap_servers=['kafka:29092'],
          auto_offset_reset='earliest',
          enable_auto_commit=True,
          value_deserializer=lambda m: json.loads(m.decode('utf-8'))
      )
      
      # PostgreSQL connection
      engine = create_engine('postgresql://analytics_user:analytics_pass@analytics-postgres:5432/analytics')
      
      print("🎧 Listening to Kafka stream...")
      
      for message in consumer:
          user = message.value
          
          try:
              # Transform user data
              user_record = {
                  'user_id': user['login']['uuid'],
                  'gender': user['gender'],
                  'title': user['name']['title'],
                  'first_name': user['name']['first'],
                  'last_name': user['name']['last'],
                  'email': user['email'],
                  'username': user['login']['username'],
                  'date_of_birth': user['dob']['date'],
                  'age': user['dob']['age'],
                  'phone': user['phone'],
                  'cell': user['cell'],
                  'street_number': str(user['location']['street']['number']),
                  'street_name': user['location']['street']['name'],
                  'city': user['location']['city'],
                  'state': user['location']['state'],
                  'country': user['location']['country'],
                  'postcode': str(user['location']['postcode']),
                  'latitude': str(user['location']['coordinates']['latitude']),
                  'longitude': str(user['location']['coordinates']['longitude']),
                  'timezone_offset': user['location']['timezone']['offset'],
                  'timezone_description': user['location']['timezone']['description'],
                  'nationality': user['nat'],
                  'picture_large': user['picture']['large'],
                  'picture_medium': user['picture']['medium'],
                  'picture_thumbnail': user['picture']['thumbnail'],
                  'registered_date': user['registered']['date'],
                  'registered_age': user['registered']['age']
              }
              
              # Insert to PostgreSQL
              with engine.begin() as conn:
                  insert_sql = text("""
                      INSERT INTO public.incoming_users (
                          user_id, gender, title, first_name, last_name, email, username,
                          date_of_birth, age, phone, cell, street_number, street_name,
                          city, state, country, postcode, latitude, longitude,
                          timezone_offset, timezone_description, nationality,
                          picture_large, picture_medium, picture_thumbnail,
                          registered_date, registered_age, synced_at
                      ) VALUES (
                          :user_id, :gender, :title, :first_name, :last_name, :email, :username,
                          :date_of_birth, :age, :phone, :cell, :street_number, :street_name,
                          :city, :state, :country, :postcode, :latitude, :longitude,
                          :timezone_offset, :timezone_description, :nationality,
                          :picture_large, :picture_medium, :picture_thumbnail,
                          :registered_date, :registered_age, CURRENT_TIMESTAMP
                      )
                      ON CONFLICT (user_id) DO UPDATE SET synced_at = CURRENT_TIMESTAMP
                  """)
                  conn.execute(insert_sql, user_record)
              
              print(f"✅ Loaded: {user_record['first_name']} {user_record['last_name']}")
              
          except Exception as e:
              print(f"❌ Error processing user: {str(e)}")

triggers:
  - id: auto_start_consumer
    type: io.kestra.plugin.core.trigger.Flow
    conditions:
      - type: io.kestra.plugin.core.condition.ExecutionFlowCondition
        namespace: demo
        flowId: kafka_streaming_users
```

**Pros:**
- ✅ True continuous streaming
- ✅ Decoupled producer/consumer
- ✅ Fault-tolerant (Kafka durability)
- ✅ Scalable (multiple consumers)
- ✅ Industry-standard solution

**Cons:**
- ❌ Complex setup (3 new services)
- ❌ Higher resource usage
- ❌ Requires Kafka knowledge
- ❌ More moving parts to maintain

**Expected Throughput:**
- 1 user per second = 3,600 users/hour = 86,400 users/day

---

### Option 3: WebSocket Streaming ⭐⭐⭐ MOST REALISTIC

**Best for**: True real-time dashboards, IoT, live events

**Architecture**:
```
Data Source → WebSocket Server → WebSocket Clients → Database
                                      ↓
                                   Grafana
```

**Implementation**:

#### Create WebSocket Server

`streaming_server/websocket_server.py`:
```python
import asyncio
import websockets
import json
import aiohttp
from datetime import datetime

connected_clients = set()

async def fetch_user():
    """Fetch user from Random User API"""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            'https://randomuser.me/api/?results=1&inc=gender,name,email,login,dob,registered,phone,cell,picture,location,nat'
        ) as response:
            data = await response.json()
            return data['results'][0]

async def stream_users():
    """Continuously stream users to all connected clients"""
    while True:
        try:
            user = await fetch_user()
            user['timestamp'] = datetime.now().isoformat()
            
            # Broadcast to all connected clients
            if connected_clients:
                message = json.dumps(user)
                await asyncio.gather(
                    *[client.send(message) for client in connected_clients],
                    return_exceptions=True
                )
                print(f"📡 Broadcast user: {user['name']['first']} {user['name']['last']}")
            
            # Rate limiting: 1 user per second
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await asyncio.sleep(5)

async def handler(websocket, path):
    """Handle WebSocket connections"""
    connected_clients.add(websocket)
    print(f"✅ Client connected. Total: {len(connected_clients)}")
    
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.remove(websocket)
        print(f"❌ Client disconnected. Total: {len(connected_clients)}")

async def main():
    # Start streaming task
    asyncio.create_task(stream_users())
    
    # Start WebSocket server
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("🚀 WebSocket server started on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
```

#### Create WebSocket Client (Consumer)

`streaming_server/websocket_client.py`:
```python
import asyncio
import websockets
import json
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://analytics_user:analytics_pass@localhost:5433/analytics')

async def consume_stream():
    """Connect to WebSocket and consume user stream"""
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        print("🎧 Connected to user stream...")
        
        async for message in websocket:
            user = json.loads(message)
            
            # Transform and insert
            user_record = {
                'user_id': user['login']['uuid'],
                'gender': user['gender'],
                'title': user['name']['title'],
                'first_name': user['name']['first'],
                'last_name': user['name']['last'],
                'email': user['email'],
                'username': user['login']['username'],
                'date_of_birth': user['dob']['date'],
                'age': user['dob']['age'],
                'phone': user['phone'],
                'cell': user['cell'],
                'street_number': str(user['location']['street']['number']),
                'street_name': user['location']['street']['name'],
                'city': user['location']['city'],
                'state': user['location']['state'],
                'country': user['location']['country'],
                'postcode': str(user['location']['postcode']),
                'latitude': str(user['location']['coordinates']['latitude']),
                'longitude': str(user['location']['coordinates']['longitude']),
                'timezone_offset': user['location']['timezone']['offset'],
                'timezone_description': user['location']['timezone']['description'],
                'nationality': user['nat'],
                'picture_large': user['picture']['large'],
                'picture_medium': user['picture']['medium'],
                'picture_thumbnail': user['picture']['thumbnail'],
                'registered_date': user['registered']['date'],
                'registered_age': user['registered']['age']
            }
            
            with engine.begin() as conn:
                insert_sql = text("""
                    INSERT INTO public.incoming_users (
                        user_id, gender, title, first_name, last_name, email, username,
                        date_of_birth, age, phone, cell, street_number, street_name,
                        city, state, country, postcode, latitude, longitude,
                        timezone_offset, timezone_description, nationality,
                        picture_large, picture_medium, picture_thumbnail,
                        registered_date, registered_age, synced_at
                    ) VALUES (
                        :user_id, :gender, :title, :first_name, :last_name, :email, :username,
                        :date_of_birth, :age, :phone, :cell, :street_number, :street_name,
                        :city, :state, :country, :postcode, :latitude, :longitude,
                        :timezone_offset, :timezone_description, :nationality,
                        :picture_large, :picture_medium, :picture_thumbnail,
                        :registered_date, :registered_age, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (user_id) DO UPDATE SET synced_at = CURRENT_TIMESTAMP
                """)
                conn.execute(insert_sql, user_record)
            
            print(f"✅ Inserted: {user_record['first_name']} {user_record['last_name']}")

if __name__ == "__main__":
    asyncio.run(consume_stream())
```

**Pros:**
- ✅ True real-time (sub-second latency)
- ✅ Push-based (no polling)
- ✅ Bidirectional communication
- ✅ Multiple clients supported

**Cons:**
- ❌ Need to manage WebSocket server
- ❌ Connection management complexity
- ❌ No built-in persistence (unlike Kafka)

---

## 📊 Comparison Table

| Feature | Current (Batch) | Option 1 (Micro-batch) | Option 2 (Kafka) ⭐ | Option 3 (WebSocket) |
|---------|----------------|----------------------|------------------|---------------------|
| **Latency** | 60 seconds | 10 seconds | <1 second | <0.5 seconds |
| **Complexity** | Low | Low | High | Medium |
| **Setup Time** | ✅ Done | 5 minutes | 2-3 hours | 1 hour |
| **New Services** | 0 | 0 | 3 (Kafka, Zookeeper, Connect) | 1 (WebSocket server) |
| **Scalability** | Limited | Limited | **Excellent** ⭐ | Good |
| **Industry Use** | Legacy | Legacy | **Production Standard** ⭐ | Niche use cases |
| **Resume Value** | Low | Low | **High** ⭐ | Medium |
| **Data Durability** | ❌ None | ❌ None | **✅ Persistent** ⭐ | ❌ None |
| **Replay Capability** | ❌ No | ❌ No | **✅ Yes** ⭐ | ❌ No |
| **Cost** | Low | Low | Medium-High | Low-Medium |
| **Best For** | Testing | Near real-time | **Production/Portfolio** ⭐ | Live dashboards |

**⭐ = Kafka advantages that matter in production**

---

## 🎯 Recommendations

### For Your Current Setup:

**⭐ BEST FOR PORTFOLIO - Implement Option 2 (Kafka)**: 
- ✅ **Industry-standard technology** - What companies actually use
- ✅ **Most impressive on resume** - Shows production-ready skills
- ✅ **Scalable architecture** - Demonstrates understanding of distributed systems
- ✅ **Career-relevant** - Kafka is in high demand
- ⚠️ **More complex** - But worth the learning investment

**Quick Win (If Short on Time) - Option 3 (WebSocket)**:
- ✅ Fast to implement (1 hour)
- ✅ Demonstrates real-time streaming concepts
- ⚠️ Not production-grade
- ⚠️ Less impressive to technical interviewers

**Minimal Change - Option 1 (Micro-batching)**:
- ✅ 5-minute config change
- ✅ Improves existing setup
- ❌ Still batch processing, not true streaming
- ❌ Won't stand out in interviews

---

## 💼 Why Kafka Matters for Your Career

**In technical interviews, you'll be asked:**
- "How do you handle real-time data pipelines?"
- "What's your experience with distributed streaming?"
- "Tell me about a time you built a scalable system"

**Having Kafka in your portfolio means:**
- ✅ You can answer with production-relevant experience
- ✅ You understand distributed systems concepts
- ✅ You've worked with industry-standard tools
- ✅ You're ready for senior-level responsibilities

**WebSockets are great for:**
- Real-time dashboards (like stock tickers)
- Chat applications
- Gaming
- IoT sensors to UI

**But Kafka is used for:**
- Event-driven microservices (what most companies build)
- Data pipelines (ETL/ELT at scale)
- Stream processing (real-time analytics)
- Log aggregation (monitoring systems)

---

## 🚀 Quick Start Commands

### Option 1: Micro-batching
```powershell
# Update workflow in Kestra UI
# Change cron to: */10 * * * * *
# Change batch_size to: 2
# Update Grafana refresh to 1 second
```

### Option 2: Kafka
```powershell
# Start Kafka services
docker-compose -f docker-compose.kafka.yml up -d

# Deploy workflows to Kestra
# Upload kafka_streaming_users.yml
# Upload kafka_consumer_to_postgres.yml
```

### Option 3: WebSocket
```powershell
# Install dependencies
pip install asyncio websockets aiohttp sqlalchemy psycopg2-binary

# Start server
python streaming_server/websocket_server.py

# Start consumer (in another terminal)
python streaming_server/websocket_client.py
```

---

## 📈 Expected Throughput

| Option | Users/Second | Users/Minute | Users/Hour | Users/Day |
|--------|-------------|--------------|------------|-----------|
| Current | 0.17 | 10 | 600 | 14,400 |
| Option 1 | 0.2 | 12 | 720 | 17,280 |
| Option 2 | 1.0 | 60 | 3,600 | 86,400 |
| Option 3 | 1.0 | 60 | 3,600 | 86,400 |

---

## 📚 Learning Resources

- **Kafka**: https://kafka.apache.org/quickstart
- **WebSockets**: https://websockets.readthedocs.io/
- **Kestra Streaming**: https://kestra.io/docs/developer-guide/triggers
- **Grafana Live**: https://grafana.com/docs/grafana/latest/setup-grafana/set-up-grafana-live/
