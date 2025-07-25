import asyncio
import websockets
import socket

TCP_HOST = 'localhost'
TCP_PORT = 8765
WS_PORT = 8000

clients = set()

async def tcp_reader():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((TCP_HOST, TCP_PORT))
        buffer = b""
        while True:
            data = s.recv(1024)
            if not data:
                break
            buffer += data
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                msg = line.decode()
                # Broadcast to all WebSocket clients
                await asyncio.gather(*(client.send(msg) for client in clients))

async def ws_handler(websocket, path):
    clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        clients.remove(websocket)

async def main():
    ws_server = await websockets.serve(ws_handler, "localhost", WS_PORT)
    await tcp_reader()

asyncio.run(main())