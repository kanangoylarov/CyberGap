import random
from typing import Optional

from fastapi import Request

from app.services.behavior.base import BaseBehavior

ERROR_RESPONSES = {
    400: [
        {"error": "Bad Request", "message": "The request could not be understood by the server due to malformed syntax."},
        {"error": "Bad Request", "message": "Invalid JSON payload. Expected a valid JSON object."},
        {"error": "Bad Request", "message": "Missing required parameter: 'id'. Please check the API documentation."},
    ],
    403: [
        {"error": "Forbidden", "message": "You do not have permission to access this resource."},
        {"error": "Forbidden", "message": "Access denied. Your IP address has been logged."},
        {"error": "Forbidden", "message": "CSRF token validation failed. Please refresh and try again."},
    ],
    500: [
        {"error": "Internal Server Error", "message": "An unexpected error occurred. Please try again later."},
        {"error": "Internal Server Error", "message": "Database connection failed: SQLSTATE[HY000] [2002] Connection refused"},
        {"error": "Internal Server Error", "message": "Segmentation fault in module 'core.handler' at 0x7f3a2c001000"},
    ],
    502: [
        {"error": "Bad Gateway", "message": "The upstream server returned an invalid response."},
        {"error": "Bad Gateway", "message": "nginx: upstream prematurely closed connection while reading response header"},
    ],
    503: [
        {"error": "Service Unavailable", "message": "The server is temporarily unable to handle the request. Please try again later."},
        {"error": "Service Unavailable", "message": "Server is under heavy load. Rate limit exceeded: 429 -> 503 cascade."},
        {"error": "Service Unavailable", "message": "Maintenance in progress. Estimated downtime: 15 minutes."},
    ],
}

SERVER_HEADERS = [
    "Apache/2.4.41 (Ubuntu)",
    "Apache/2.4.52 (Debian)",
    "nginx/1.18.0 (Ubuntu)",
    "nginx/1.20.1",
    "nginx/1.22.0",
    "Microsoft-IIS/10.0",
    "Microsoft-IIS/8.5",
]


class FuzzersBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "fuzzers"

    async def pre_response_hook(self, request: Request) -> Optional[dict]:
        if random.random() < 0.10:
            status_code = random.choice(list(ERROR_RESPONSES.keys()))
            error_body = random.choice(ERROR_RESPONSES[status_code])
            return {
                "status_code": status_code,
                "body": error_body,
            }
        return None

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = random.choice(SERVER_HEADERS)
        headers["X-Powered-By"] = random.choice([
            "PHP/7.4.3",
            "PHP/8.1.2",
            "ASP.NET",
            "Express",
            "Phusion Passenger 6.0.12",
        ])
        return headers
