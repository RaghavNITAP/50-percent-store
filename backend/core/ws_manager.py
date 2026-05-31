from fastapi import WebSocket
from typing import Dict, Set
import json


class ConnectionManager:
    def __init__(self):
        # conversation_id -> set of websockets
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: str):
        await websocket.accept()
        if conversation_id not in self.active:
            self.active[conversation_id] = set()
        self.active[conversation_id].add(websocket)

    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active:
            self.active[conversation_id].discard(websocket)
            if not self.active[conversation_id]:
                del self.active[conversation_id]

    async def broadcast(self, conversation_id: str, message: dict, exclude: WebSocket = None):
        if conversation_id not in self.active:
            return
        dead = set()
        for ws in self.active[conversation_id]:
            if ws == exclude:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active[conversation_id].discard(ws)

    async def send_personal(self, websocket: WebSocket, message: dict):
        await websocket.send_text(json.dumps(message))


manager = ConnectionManager()