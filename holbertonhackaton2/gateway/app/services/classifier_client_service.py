import time

import httpx

from app.models.schemas import ClassifyRequest, ClassifyResponse
from app.core.constants import ATTACK_LABELS
from app.utils.logging import logger


class ClassifierClientService:
    """HTTP client that sends feature vectors to the AI classifier service."""

    def __init__(self, base_url: str):
        self._base_url = base_url.rstrip("/")

    async def classify(self, features: ClassifyRequest) -> ClassifyResponse:
        """POST features to the AI classifier. Fail-open: returns Normal on any error."""
        url = f"{self._base_url}/classify"
        payload = features.model_dump()
        start = time.perf_counter()

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()

            elapsed = (time.perf_counter() - start) * 1000
            data = response.json()
            attack_type = data.get("attack_type", 0)

            return ClassifyResponse(
                attack_type=attack_type,
                attack_label=ATTACK_LABELS.get(attack_type, "Unknown"),
                confidence=data.get("confidence", 0.0),
                inference_time_ms=elapsed,
            )

        except httpx.TimeoutException:
            elapsed = (time.perf_counter() - start) * 1000
            logger.warning("AI classifier timeout after %.1f ms", elapsed)
            return ClassifyResponse(
                attack_type=0,
                attack_label="Normal",
                confidence=0.0,
                inference_time_ms=elapsed,
            )

        except httpx.HTTPStatusError as e:
            elapsed = (time.perf_counter() - start) * 1000
            logger.warning(
                "AI classifier HTTP error: %d", e.response.status_code
            )
            return ClassifyResponse(
                attack_type=0,
                attack_label="Normal",
                confidence=0.0,
                inference_time_ms=elapsed,
            )

        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error("AI classifier error: %s", e)
            return ClassifyResponse(
                attack_type=0,
                attack_label="Normal",
                confidence=0.0,
                inference_time_ms=elapsed,
            )
