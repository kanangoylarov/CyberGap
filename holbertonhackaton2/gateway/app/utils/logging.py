import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config import settings


def setup_logger(name: str = "gateway") -> logging.Logger:
    """Create and return a JSON-formatted logger."""
    _logger = logging.getLogger(name)

    if _logger.handlers:
        return _logger

    _logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )
    handler.setFormatter(formatter)
    _logger.addHandler(handler)
    _logger.propagate = False

    return _logger


logger = setup_logger()
