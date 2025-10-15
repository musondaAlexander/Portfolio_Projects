"""
WebSocket Client for Real-time User Data Consumer

This client connects to the WebSocket server and consumes
user data in real-time, loading it into PostgreSQL.

Usage:
    python websocket_client.py
"""

import asyncio
import websockets
import json
from sqlalchemy import create_engine, text
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'analytics',
    'user': 'analytics_user',
    'password': 'analytics_pass'
}

# Create database engine
engine = create_engine(
    f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@"
    f"{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
)

users_inserted = 0


def insert_user(user_data):
    """
    Insert user data into PostgreSQL database.
    
    Args:
        user_data (dict): User data from WebSocket stream
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Transform user data to match database schema
        user_record = {
            'user_id': user_data['login']['uuid'],
            'gender': user_data['gender'],
            'title': user_data['name']['title'],
            'first_name': user_data['name']['first'],
            'last_name': user_data['name']['last'],
            'email': user_data['email'],
            'username': user_data['login']['username'],
            'date_of_birth': user_data['dob']['date'],
            'age': user_data['dob']['age'],
            'phone': user_data['phone'],
            'cell': user_data['cell'],
            'street_number': str(user_data['location']['street']['number']),
            'street_name': user_data['location']['street']['name'],
            'city': user_data['location']['city'],
            'state': user_data['location']['state'],
            'country': user_data['location']['country'],
            'postcode': str(user_data['location']['postcode']),
            'latitude': str(user_data['location']['coordinates']['latitude']),
            'longitude': str(user_data['location']['coordinates']['longitude']),
            'timezone_offset': user_data['location']['timezone']['offset'],
            'timezone_description': user_data['location']['timezone']['description'],
            'nationality': user_data['nat'],
            'picture_large': user_data['picture']['large'],
            'picture_medium': user_data['picture']['medium'],
            'picture_thumbnail': user_data['picture']['thumbnail'],
            'registered_date': user_data['registered']['date'],
            'registered_age': user_data['registered']['age']
        }
        
        # Insert into database with upsert (ON CONFLICT)
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
                ON CONFLICT (user_id) DO UPDATE SET 
                    synced_at = CURRENT_TIMESTAMP
            """)
            conn.execute(insert_sql, user_record)
        
        return True
        
    except Exception as e:
        logging.error(f"❌ Database error: {e}")
        return False


async def consume_stream(server_uri="ws://localhost:8765"):
    """
    Connect to WebSocket server and consume user stream.
    
    Args:
        server_uri (str): WebSocket server URI
    """
    global users_inserted
    
    logging.info("=" * 60)
    logging.info("🎧 Real-time User Data Consumer")
    logging.info("=" * 60)
    logging.info(f"🔗 Connecting to: {server_uri}")
    logging.info(f"💾 Database: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
    logging.info("=" * 60)
    
    retry_delay = 5
    
    while True:
        try:
            async with websockets.connect(server_uri) as websocket:
                logging.info("✅ Connected to user stream!")
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        
                        # Handle welcome message
                        if data.get('type') == 'welcome':
                            logging.info(f"👋 {data['message']}")
                            logging.info(f"📊 Server stats: {data['total_users_streamed']} users streamed")
                            continue
                        
                        # Process user data
                        if insert_user(data):
                            users_inserted += 1
                            
                            # Log details
                            name = f"{data['name']['first']} {data['name']['last']}"
                            country = data['location']['country']
                            sequence = data.get('stream_sequence', '?')
                            
                            logging.info(
                                f"✅ #{users_inserted} (Stream #{sequence}): "
                                f"{name} from {country}"
                            )
                            
                            # Periodic summary
                            if users_inserted % 60 == 0:
                                logging.info(f"📊 Milestone: {users_inserted} users inserted!")
                    
                    except json.JSONDecodeError as e:
                        logging.error(f"❌ Invalid JSON: {e}")
                    except Exception as e:
                        logging.error(f"❌ Processing error: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            logging.warning(f"⚠️ Connection closed. Reconnecting in {retry_delay}s...")
            await asyncio.sleep(retry_delay)
        
        except Exception as e:
            logging.error(f"❌ Connection error: {e}")
            logging.info(f"🔄 Retrying in {retry_delay}s...")
            await asyncio.sleep(retry_delay)


async def main():
    """Main client entry point"""
    try:
        await consume_stream()
    except KeyboardInterrupt:
        logging.info("\n👋 Consumer shutting down...")
        logging.info(f"📊 Final stats: {users_inserted} users inserted")


if __name__ == "__main__":
    asyncio.run(main())
