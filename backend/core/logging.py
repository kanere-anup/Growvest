"""
Centralized logging setup for the backend using Loguru.
- Console and rotating file handlers
- Intercepts standard logging and Uvicorn logs
- Request logging middleware with request IDs
"""
import logging
import sys
import uuid
import time
from typing import Optional

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class InterceptHandler(logging.Handler):
    """Redirect standard logging records to Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        # Find caller from where logging was called
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_name == "emit":
            frame = frame.f_back
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging(level: Optional[str] = None, log_file: Optional[str] = None) -> None:
    """Configure Loguru and integrate std logging/uvicorn.

    Args:
        level: Log level name (e.g., "INFO"). If None, uses settings.LOG_LEVEL.
        log_file: File path for rotating logs. If None, uses settings.LOG_FILE.
    """
    from pathlib import Path
    from core.config import settings

    lvl = (level or settings.LOG_LEVEL or "INFO").upper()
    file_path = log_file or settings.LOG_FILE

    # Ensure log directory exists
    Path(file_path).parent.mkdir(parents=True, exist_ok=True)

    # Remove default handlers
    logger.remove()

    # Console handler (human-readable)
    logger.add(
        sys.stdout,
        level=lvl,
        colorize=True,
        enqueue=True,
        backtrace=False,
        diagnose=False,
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
               "<level>{message}</level> | {extra}"
    )

    # Rotating file handler (persisted logs)
    logger.add(
        file_path,
        rotation="1 day",
        retention="30 days",
        compression="zip",
        level=lvl,
        enqueue=True,
        backtrace=False,
        diagnose=False,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message} | {extra}"
    )

    # Intercept standard logging
    intercept = InterceptHandler()
    root_logger = logging.getLogger()
    root_logger.handlers = [intercept]
    root_logger.setLevel(getattr(logging, lvl, logging.INFO))

    # Route third-party loggers through Loguru
    for name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "sqlalchemy",
        "asyncio",
    ):
        log = logging.getLogger(name)
        log.handlers = [intercept]
        log.propagate = False
        log.setLevel(getattr(logging, lvl, logging.INFO))


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs each request with a correlation ID and latency."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        method = request.method
        path = request.url.path
        client = request.client.host if request.client else "-"
        ua = request.headers.get("user-agent", "-")
        start = time.time()

        with logger.contextualize(request_id=request_id, client=client, path=path, method=method):
            logger.info(f"-> {method} {path} from {client} ua='{ua}'")
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = int((time.time() - start) * 1000)
                logger.exception(f"xx {method} {path} failed after {duration_ms}ms")
                raise
            duration_ms = int((time.time() - start) * 1000)
            status = getattr(response, "status_code", 0)
            logger.info(f"<- {status} {method} {path} {duration_ms}ms")
            response.headers["X-Request-ID"] = request_id
            return response