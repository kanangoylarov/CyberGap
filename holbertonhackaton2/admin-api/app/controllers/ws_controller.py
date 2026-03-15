import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.dependencies import get_live_stream_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/api/admin/ws/live")
async def live_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time log streaming.

    Protocol:
    1. Client connects to ws://host/api/admin/ws/live
    2. Server accepts the connection.
    3. Client can optionally send { "last_id": 12345 } to resume from a specific point.
    4. Server begins polling the database every WS_POLL_INTERVAL seconds.
    5. When new logs are found, server sends: { "type": "logs", "data": [...] }
    6. Server sends periodic heartbeats: { "type": "heartbeat", "timestamp": "..." }
    7. On disconnect, server cleans up resources.
    """
    await websocket.accept()

    service = get_live_stream_service()

    # Check if client sends an initial last_id
    last_id = 0
    try:
        # Non-blocking receive with a short timeout to check for initial message
        import asyncio
        try:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
            if isinstance(data, dict) and "last_id" in data:
                last_id = int(data["last_id"])
        except asyncio.TimeoutError:
            pass
        except Exception:
            pass
    except Exception:
        pass

    try:
        await service.stream_logs(websocket, last_id=last_id)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", str(e))
