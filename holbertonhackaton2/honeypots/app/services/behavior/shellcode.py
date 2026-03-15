import logging
import random
import string
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.shellcode")


def _hex_preview(data: bytes, max_bytes: int = 128) -> str:
    """Return a hex dump preview string of the first max_bytes bytes."""
    preview_bytes = data[:max_bytes]
    hex_lines = []
    for i in range(0, len(preview_bytes), 16):
        chunk = preview_bytes[i : i + 16]
        hex_part = " ".join(f"{b:02x}" for b in chunk)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        hex_lines.append(f"{i:08x}  {hex_part:<48s}  |{ascii_part}|")
    return "\n".join(hex_lines)


def _random_fake_output() -> str:
    """Generate a realistic-looking fake execution output."""
    outputs = [
        "Segmentation fault (core dumped)",
        "Process exited normally.",
        "",
        f"[*] Payload executed successfully\n[*] Session opened at 10.0.3.15:{random.randint(4000, 9000)}",
        f"[+] Allocated {random.randint(1024, 65536)} bytes at 0x{random.randint(0x400000, 0x7fffff):x}",
        "Listening on 0.0.0.0:4444...\nConnection received.",
        f"child process {random.randint(10000, 65000)} exited with status 0",
    ]
    return random.choice(outputs)


class ShellcodeBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "shellcode"

    def get_extra_router(self) -> APIRouter:
        router = APIRouter()

        @router.post("/api/upload")
        async def upload_binary(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            body = await request.body()
            hex_preview = _hex_preview(body)
            logger.warning(
                "CRITICAL: Binary upload from %s — size=%d bytes\nHex preview:\n%s",
                source_ip,
                len(body),
                hex_preview,
            )
            file_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=12))
            return JSONResponse(
                content={
                    "status": "uploaded",
                    "size": len(body),
                    "file_id": file_id,
                    "stored_at": f"/tmp/uploads/{file_id}.bin",
                    "sha256": "".join(random.choices("0123456789abcdef", k=64)),
                },
                status_code=200,
            )

        @router.post("/api/execute")
        async def execute_binary(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            body = await request.body()
            hex_preview = _hex_preview(body)
            logger.warning(
                "CRITICAL: Binary execution attempt from %s — size=%d bytes\nHex preview:\n%s",
                source_ip,
                len(body),
                hex_preview,
            )
            fake_output = _random_fake_output()
            return JSONResponse(
                content={
                    "status": "executed",
                    "exit_code": 0,
                    "output": fake_output,
                    "pid": random.randint(10000, 65000),
                    "execution_time_ms": round(random.uniform(0.5, 50.0), 2),
                },
                status_code=200,
            )

        return router

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
