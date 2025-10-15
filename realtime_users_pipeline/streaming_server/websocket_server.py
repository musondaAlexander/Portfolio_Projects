"""
WebSocket Server for Real-time User Data Streaming

This server continuously fetches user data from Random User API
and broadcasts it to all connected WebSocket clients in real-time.

Usage:
    python websocket_server.py

Connect from client:
    ws://localhost:8765
"""

import asyncio
import websockets
import json
import aiohttp
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

connected_clients = set()
total_users_streamed = 0


async def fetch_user():
    """
    Fetch a random user from Random User API.
    
    Returns:
        dict: User data from API
    """
    url = 'https://randomuser.me/api/?results=1&inc=gender,name,email,login,dob,registered,phone,cell,picture,location,nat'
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                return data['results'][0]
            else:
                logging.error(f"API request failed with status {response.status}")
                return None


async def stream_users():
    """
    Continuously fetch users and broadcast to all connected clients.
    Streams 1 user per second to avoid API rate limiting.
    """
    global total_users_streamed
    
    logging.info("🚀 Starting user stream...")
    
    while True:
        try:
            # Fetch user from API
            user = await fetch_user()
            
            if user:
                # Add server timestamp
                user['server_timestamp'] = datetime.now().isoformat()
                user['stream_sequence'] = total_users_streamed + 1
                
                # Broadcast to all connected clients
                if connected_clients:
                    message = json.dumps(user)
                    
                    # Send to all clients concurrently
                    results = await asyncio.gather(
                        *[client.send(message) for client in connected_clients],
                        return_exceptions=True
                    )
                    
                    # Count successful sends
                    successful = sum(1 for r in results if not isinstance(r, Exception))
                    
                    total_users_streamed += 1
                    logging.info(
                        f"📡 Broadcast #{total_users_streamed}: "
                        f"{user['name']['first']} {user['name']['last']} "
                        f"({user['location']['country']}) to {successful} clients"
                    )
                else:
                    logging.debug("No clients connected, skipping broadcast")
            
            # Rate limiting: 1 user per second (3600/hour, well within 6000/hour limit)
            await asyncio.sleep(1)
            
        except Exception as e:
            logging.error(f"❌ Stream error: {e}")
            await asyncio.sleep(5)  # Back off on error


async def handler(websocket, path):
    """
    Handle WebSocket client connections.
    
    Args:
        websocket: WebSocket connection object
        path: Request path
    """
    # Register new client
    connected_clients.add(websocket)
    client_id = id(websocket)
    logging.info(f"✅ Client {client_id} connected from {websocket.remote_address}. Total clients: {len(connected_clients)}")
    
    try:
        # Send welcome message
        welcome = {
            "type": "welcome",
            "message": "Connected to real-time user stream",
            "total_users_streamed": total_users_streamed,
            "stream_rate": "1 user/second"
        }
        await websocket.send(json.dumps(welcome))
        
        # Keep connection alive until client disconnects
        await websocket.wait_closed()
        
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Client {client_id} connection closed normally")
    except Exception as e:
        logging.error(f"Client {client_id} error: {e}")
    finally:
        # Unregister client
        connected_clients.discard(websocket)
        logging.info(f"❌ Client {client_id} disconnected. Total clients: {len(connected_clients)}")


async def stats_reporter():
    """Periodically report server statistics"""
    while True:
        await asyncio.sleep(60)  # Report every minute
        logging.info(
            f"📊 Stats: {total_users_streamed} users streamed, "
            f"{len(connected_clients)} active clients, "
            f"~{total_users_streamed / (asyncio.get_event_loop().time() / 60):.1f} users/min"
        )


async def main():
    """Main server entry point"""
    logging.info("=" * 60)
    logging.info("🌐 Real-time User Data Streaming Server")
    logging.info("=" * 60)
    logging.info("📍 WebSocket URL: ws://localhost:8765")
    logging.info("📡 Stream rate: 1 user/second")
    logging.info("🔗 API source: https://randomuser.me/api/")
    logging.info("=" * 60)
    
    # Start background tasks
    asyncio.create_task(stream_users())
    asyncio.create_task(stats_reporter())
    
    # Start WebSocket server
    async with websockets.serve(handler, "0.0.0.0", 8765):
        logging.info("✅ Server started successfully!")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("\n👋 Server shutting down...")
        logging.info(f"📊 Final stats: {total_users_streamed} total users streamed")
