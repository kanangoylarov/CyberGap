import logging
import random
import string
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.reconnaissance")

FAKE_ENV = """# Application Environment Configuration
APP_NAME=MyShopApp
APP_ENV=production
APP_DEBUG=true
APP_KEY=base64:k8Jg3xQ7vZ2pN9mR4sT1wY6uA0cF5hL8oI3eD7bX2lM=
APP_URL=http://shop.internal.local

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=10.0.3.42
DB_PORT=3306
DB_DATABASE=myshop_production
DB_USERNAME=shop_admin
DB_PASSWORD=Pr0d_$h0p_DB!2024#Secure

# Redis Configuration
REDIS_HOST=10.0.3.45
REDIS_PASSWORD=R3d!s_Pr0d_P@ss_2024
REDIS_PORT=6379

# AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=myshop-assets-prod

# Stripe Payment
STRIPE_KEY=pk_live_51H7xYzKl3mN9oPqRsTuVwXy
STRIPE_SECRET=sk_test_51H7xYzKl3mN9oPqRsTuVwXyZaBcDeFgHiJkLmNoPq
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef

# JWT Secret
JWT_SECRET=super_secret_jwt_key_do_not_share_2024!
JWT_TTL=3600

# Mail Configuration
MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=587
MAIL_USERNAME=admin@myshopapp.com
MAIL_PASSWORD=M@ilP@ss_2024!

# Internal API Keys
INTERNAL_API_KEY=int_api_k3y_s3cr3t_2024
ADMIN_SECRET_TOKEN=adm_tk_9f8e7d6c5b4a3210
"""

ROBOTS_TXT = """# robots.txt for myshopapp.com
User-agent: *
Disallow: /admin/
Disallow: /admin/dashboard/
Disallow: /admin/users/
Disallow: /admin/config/
Disallow: /api/internal/
Disallow: /api/internal/users
Disallow: /api/internal/config
Disallow: /api/internal/stats
Disallow: /backup/
Disallow: /backup/db/
Disallow: /logs/
Disallow: /logs/access.log
Disallow: /logs/error.log
Disallow: /.env
Disallow: /.git/
Disallow: /wp-admin/
Disallow: /phpmyadmin/
Disallow: /server-status
Disallow: /server-info
Disallow: /debug/
Disallow: /staging/
Disallow: /test/

Sitemap: http://myshopapp.com/sitemap.xml
"""

ADMIN_LOGIN_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>Admin Panel - Login</title>
    <style>
        body { background: #1a1a2e; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #eee; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .login-box { background: #16213e; padding: 40px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); width: 360px; }
        h1 { text-align: center; margin-bottom: 30px; font-size: 24px; color: #e94560; }
        label { display: block; margin-top: 14px; font-size: 14px; color: #aaa; }
        input[type=text], input[type=password] { width: 100%; padding: 10px; margin-top: 6px; box-sizing: border-box; background: #0f3460; border: 1px solid #333; border-radius: 4px; color: #eee; font-size: 14px; }
        input[type=submit] { width: 100%; padding: 12px; margin-top: 24px; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
        input[type=submit]:hover { background: #c73650; }
        .error { color: #e94560; text-align: center; font-size: 13px; margin-top: 12px; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>Admin Panel</h1>
        <form method="POST" action="/admin/login">
            <label>Username
                <input type="text" name="username" autocomplete="off" />
            </label>
            <label>Password
                <input type="password" name="password" />
            </label>
            <input type="submit" value="Sign In" />
            {error}
        </form>
        <div class="footer">MyShopApp Admin v3.2.1</div>
    </div>
</body>
</html>"""

BACKUP_FILES = [
    {"name": "db_backup_2024-01-15.sql.gz", "size": "245 MB", "modified": "2024-01-15 03:00:01"},
    {"name": "db_backup_2024-02-15.sql.gz", "size": "312 MB", "modified": "2024-02-15 03:00:01"},
    {"name": "db_backup_2024-03-15.sql.gz", "size": "298 MB", "modified": "2024-03-15 03:00:02"},
    {"name": "full_site_backup_2024-03-01.tar.gz", "size": "1.4 GB", "modified": "2024-03-01 04:00:00"},
    {"name": "user_data_export_2024-03-10.csv.gz", "size": "89 MB", "modified": "2024-03-10 02:30:00"},
    {"name": "config_backup_2024-03-14.zip", "size": "2.1 MB", "modified": "2024-03-14 23:00:00"},
    {"name": "media_backup_2024-02-28.tar.gz", "size": "3.8 GB", "modified": "2024-02-28 05:00:00"},
    {"name": ".htaccess.bak", "size": "4.2 KB", "modified": "2024-01-05 14:22:33"},
    {"name": "wp-config.php.bak", "size": "3.8 KB", "modified": "2024-01-10 09:15:00"},
]


def _random_sku() -> str:
    return "INT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _random_supplier_code() -> str:
    return "SUP-" + "".join(random.choices(string.digits, k=6))


def _random_warehouse() -> str:
    warehouses = [
        "WH-A3-R12-S04", "WH-B1-R07-S19", "WH-C2-R03-S11",
        "WH-A1-R22-S08", "WH-D4-R15-S02", "WH-B3-R09-S16",
    ]
    return random.choice(warehouses)


class ReconnaissanceBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "reconnaissance"

    def modify_product_response(self, products: list[dict]) -> list[dict]:
        for product in products:
            product["_internal_sku"] = _random_sku()
            product["_supplier_code"] = _random_supplier_code()
            product["_cost_price"] = round(product.get("price", 10.0) * random.uniform(0.25, 0.55), 2)
            product["_warehouse_location"] = _random_warehouse()
        return products

    def get_extra_router(self) -> APIRouter:
        router = APIRouter()

        @router.get("/robots.txt", response_class=PlainTextResponse)
        async def robots_txt(request: Request):
            logger.warning(
                "robots.txt accessed from %s",
                request.client.host if request.client else "unknown",
            )
            return PlainTextResponse(content=ROBOTS_TXT, status_code=200)

        @router.get("/.env", response_class=PlainTextResponse)
        async def dot_env(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning("CRITICAL: .env file accessed from %s", source_ip)
            return PlainTextResponse(content=FAKE_ENV, status_code=200)

        @router.get("/admin/", response_class=HTMLResponse)
        @router.get("/admin", response_class=HTMLResponse)
        async def admin_page(request: Request):
            logger.warning(
                "Admin page accessed from %s",
                request.client.host if request.client else "unknown",
            )
            return HTMLResponse(
                content=ADMIN_LOGIN_HTML.format(error=""), status_code=200
            )

        @router.post("/admin/login", response_class=HTMLResponse)
        async def admin_login(request: Request):
            form = await request.form()
            username = form.get("username", "")
            password = form.get("password", "")
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "Admin login attempt from %s — user=%s pass=%s",
                source_ip,
                username,
                password,
            )
            error_html = '<p class="error">Invalid credentials. This attempt has been logged.</p>'
            return HTMLResponse(
                content=ADMIN_LOGIN_HTML.format(error=error_html), status_code=200
            )

        @router.get("/backup/", response_class=HTMLResponse)
        @router.get("/backup", response_class=HTMLResponse)
        async def backup_list(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning("Backup directory listing accessed from %s", source_ip)
            rows = ""
            for f in BACKUP_FILES:
                rows += (
                    f'<tr><td><a href="/backup/{f["name"]}">{f["name"]}</a></td>'
                    f'<td>{f["size"]}</td><td>{f["modified"]}</td></tr>\n'
                )
            html = f"""<!DOCTYPE html>
<html>
<head><title>Index of /backup/</title></head>
<body>
<h1>Index of /backup/</h1>
<table border="1" cellpadding="6" cellspacing="0">
<tr><th>Name</th><th>Size</th><th>Last Modified</th></tr>
<tr><td><a href="/">../</a></td><td>-</td><td>-</td></tr>
{rows}
</table>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at shop.internal.local Port 80</address>
</body>
</html>"""
            return HTMLResponse(content=html, status_code=200)

        @router.get("/backup/{filename:path}")
        async def backup_download(filename: str, request: Request):
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "Backup file download attempt from %s — file=%s", source_ip, filename
            )
            return JSONResponse(
                content={
                    "error": "Forbidden",
                    "message": "You don't have permission to access this resource.",
                },
                status_code=403,
            )

        return router

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
