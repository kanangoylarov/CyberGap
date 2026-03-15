"""Structured JSON logging setup for the honeypot service."""

import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config import settings


def setup_logging() -> logging.Logger:
    """Configure and return the application logger with structured JSON output."""
    logger = logging.getLogger("honeypot")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))

    # Avoid duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG))

    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
        },
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Prevent propagation to root logger to avoid duplicate output
    logger.propagate = False

    return logger


# Module-level logger instance for convenient imports
logger = setup_logging()
