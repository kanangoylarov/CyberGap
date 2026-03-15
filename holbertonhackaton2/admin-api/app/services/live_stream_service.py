import asyncio
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from app.repositories.log_repository import LogRepository
from app.core.database import async_session
from app.config import settings

logger = logging.getLogger(__name__)


class LiveStreamService:
    def __init__(self):
        self.poll_interval = settings.WS_POLL_INTERVAL

    async def stream_logs(self, websocket: WebSocket, last_id: int = 0):
        """
        Main polling loop for a single WebSocket connection.
        Creates its own database session for the lifetime of the connection.
        Polls for new logs every WS_POLL_INTERVAL seconds and sends them as JSON.
        """
        async with async_session() as session:
            repo = LogRepository(session)

            # If no last_id provided, start from the current latest
            if last_id == 0:
                try:
                    last_id = await repo.get_latest_id()
                except Exception as e:
                    logger.error("Failed to get latest ID: %s", str(e))
                    await websocket.send_json({
                        "type": "error",
                        "message": "Failed to initialize stream",
                    })
                    return

            heartbeat_counter = 0

            while True:
                try:
                    # Poll for new logs
                    new_logs = await repo.get_logs_after_id(last_id, limit=50)

                    if new_logs:
                        # Serialize and send
                        log_data = []
                        for log in new_logs:
                            log_data.append({
                                "id": log.id,
                                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                                "fingerprint": log.fingerprint,
                                "source_ip": log.source_ip,
                                "attack_type": log.attack_type,
                                "attack_label": log.attack_label,
                                "confidence": log.confidence,
                                "method": log.method,
                                "path": log.path,
                                "user_agent": log.user_agent,
                            })

                        await websocket.send_json({
                            "type": "logs",
                            "data": log_data,
                        })

                        # Update last_id to the max ID in the batch
                        last_id = new_logs[-1].id

                    # Send heartbeat every 5 poll cycles
                    heartbeat_counter += 1
                    if heartbeat_counter >= 5:
                        heartbeat_counter = 0
                        await websocket.send_json({
                            "type": "heartbeat",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

                except WebSocketDisconnect:
                    logger.info("WebSocket client disconnected")
                    break
                except Exception as e:
                    logger.error("Error in WebSocket stream: %s", str(e))
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": str(e),
                        })
                    except Exception:
                        # Client is gone, exit the loop
                        break

                try:
                    await asyncio.sleep(self.poll_interval)
                except asyncio.CancelledError:
                    break
