import logging
import random
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.behavior.base import BaseBehavior

logger = logging.getLogger("honeypot.backdoor")

FAKE_LS_OUTPUT = """total 48
drwxr-xr-x  5 www-data www-data 4096 Mar 14 22:10 .
drwxr-xr-x  3 root     root     4096 Jan  5 10:30 ..
-rw-r--r--  1 www-data www-data  220 Jan  5 10:30 .bash_logout
-rw-r--r--  1 www-data www-data 3771 Jan  5 10:30 .bashrc
drwxr-xr-x  2 www-data www-data 4096 Mar 14 22:10 .cache
-rw-r--r--  1 www-data www-data  807 Jan  5 10:30 .profile
drwxr-xr-x  6 www-data www-data 4096 Mar 10 15:22 html
-rw-r--r--  1 www-data www-data 1245 Feb 28 09:14 .htaccess
drwxr-xr-x  3 www-data www-data 4096 Mar  1 04:00 backups
-rw-r--r--  1 www-data www-data 4521 Mar 14 20:00 config.php
-rw-r--r--  1 www-data www-data  892 Jan 15 08:30 db_connect.php
-rwxr-xr-x  1 www-data www-data 2048 Feb 20 16:45 cron_tasks.sh"""

FAKE_LS_LA_OUTPUT = """total 96
drwxr-xr-x  8 www-data www-data 4096 Mar 14 23:45 .
drwxr-xr-x  3 root     root     4096 Jan  5 10:30 ..
-rw-------  1 www-data www-data  512 Mar 14 22:10 .bash_history
-rw-r--r--  1 www-data www-data  220 Jan  5 10:30 .bash_logout
-rw-r--r--  1 www-data www-data 3771 Jan  5 10:30 .bashrc
drwxr-xr-x  2 www-data www-data 4096 Mar 14 22:10 .cache
drwx------  2 www-data www-data 4096 Feb 10 14:30 .ssh
-rw-r--r--  1 www-data www-data  807 Jan  5 10:30 .profile
-rw-r--r--  1 www-data www-data 2048 Mar  1 08:00 .env
drwxr-xr-x  6 www-data www-data 4096 Mar 10 15:22 html
drwxr-xr-x  3 www-data www-data 4096 Mar  1 04:00 backups
drwxr-xr-x  2 www-data www-data 4096 Mar 14 20:00 logs
-rw-r--r--  1 www-data www-data 4521 Mar 14 20:00 config.php
-rw-r--r--  1 www-data www-data  892 Jan 15 08:30 db_connect.php
-rwxr-xr-x  1 www-data www-data 2048 Feb 20 16:45 cron_tasks.sh
-rw-r--r--  1 www-data www-data  345 Jan  5 10:30 .htaccess"""

FAKE_PASSWD = """root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
syslog:x:104:110::/home/syslog:/usr/sbin/nologin
mysql:x:111:119:MySQL Server,,,:/nonexistent:/bin/false
sshd:x:112:65534::/run/sshd:/usr/sbin/nologin
deploy:x:1000:1000:Deploy User,,,:/home/deploy:/bin/bash
shopapp:x:1001:1001:Shop Application,,,:/home/shopapp:/bin/bash"""

FAKE_ID_OUTPUT = "uid=33(www-data) gid=33(www-data) groups=33(www-data)"

FAKE_UNAME_OUTPUT = "Linux shop-prod-web01 5.4.0-150-generic #167-Ubuntu SMP Mon May 15 17:35:05 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux"

FAKE_PS_OUTPUT = """  PID TTY          TIME CMD
    1 ?        00:00:05 systemd
  412 ?        00:00:01 sshd
  519 ?        00:00:03 mysqld
  623 ?        00:00:12 apache2
  625 ?        00:00:04 apache2
  626 ?        00:00:04 apache2
  627 ?        00:00:03 apache2
  789 ?        00:00:00 cron
  891 ?        00:00:02 redis-server
 1023 ?        00:00:01 php-fpm
 1024 ?        00:00:01 php-fpm
 1025 ?        00:00:00 php-fpm"""

FAKE_IFCONFIG_OUTPUT = """eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.0.3.15  netmask 255.255.255.0  broadcast 10.0.3.255
        inet6 fe80::a00:27ff:fe8d:c04d  prefixlen 64  scopeid 0x20<link>
        ether 08:00:27:8d:c0:4d  txqueuelen 1000  (Ethernet)
        RX packets 125432  bytes 84523100 (84.5 MB)
        TX packets 98231  bytes 12453200 (12.4 MB)

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 45231  bytes 6523100 (6.5 MB)
        TX packets 45231  bytes 6523100 (6.5 MB)"""

FAKE_NETSTAT_OUTPUT = """Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN
tcp        0      0 127.0.0.1:6379          0.0.0.0:*               LISTEN
tcp        0      0 10.0.3.15:80            192.168.1.105:52341     ESTABLISHED
tcp        0      0 10.0.3.15:80            192.168.1.105:52342     ESTABLISHED
tcp        0      0 10.0.3.15:443           10.0.1.50:48823         ESTABLISHED"""

COMMAND_MAP = {
    "ls": FAKE_LS_OUTPUT,
    "ls -la": FAKE_LS_LA_OUTPUT,
    "ls -al": FAKE_LS_LA_OUTPUT,
    "ls -l": FAKE_LS_OUTPUT,
    "dir": FAKE_LS_OUTPUT,
    "whoami": "www-data",
    "id": FAKE_ID_OUTPUT,
    "uname -a": FAKE_UNAME_OUTPUT,
    "uname": "Linux",
    "hostname": "shop-prod-web01",
    "pwd": "/var/www",
    "cat /etc/passwd": FAKE_PASSWD,
    "cat /etc/hostname": "shop-prod-web01",
    "cat /etc/os-release": 'NAME="Ubuntu"\nVERSION="20.04.6 LTS (Focal Fossa)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 20.04.6 LTS"\nVERSION_ID="20.04"',
    "ps aux": FAKE_PS_OUTPUT,
    "ps -ef": FAKE_PS_OUTPUT,
    "ifconfig": FAKE_IFCONFIG_OUTPUT,
    "ip addr": FAKE_IFCONFIG_OUTPUT,
    "netstat -tlnp": FAKE_NETSTAT_OUTPUT,
    "ss -tlnp": FAKE_NETSTAT_OUTPUT,
    "env": "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOME=/var/www\nUSER=www-data\nSHELL=/usr/sbin/nologin\nLANG=en_US.UTF-8",
    "uptime": " 23:45:12 up 45 days,  3:22,  0 users,  load average: 0.42, 0.35, 0.28",
    "w": " 23:45:12 up 45 days,  3:22,  0 users,  load average: 0.42, 0.35, 0.28\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT",
    "df -h": "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   22G   26G  46% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm\ntmpfs           393M  5.6M  388M   2% /run",
    "free -m": "              total        used        free      shared  buff/cache   available\nMem:           3944        1823         312         156        1808        1689\nSwap:          2047         128        1919",
}


def _get_fake_output(cmd: str) -> str:
    """Return fake output for a given command."""
    cmd_stripped = cmd.strip()
    if cmd_stripped in COMMAND_MAP:
        return COMMAND_MAP[cmd_stripped]

    # Partial matching for common commands
    cmd_lower = cmd_stripped.lower()
    if cmd_lower.startswith("cat /etc/passwd"):
        return FAKE_PASSWD
    if cmd_lower.startswith("ls"):
        return FAKE_LS_OUTPUT
    if cmd_lower.startswith("whoami"):
        return "www-data"
    if cmd_lower.startswith("id"):
        return FAKE_ID_OUTPUT
    if cmd_lower.startswith("uname"):
        return FAKE_UNAME_OUTPUT
    if cmd_lower.startswith("pwd"):
        return "/var/www"
    if cmd_lower.startswith("ps"):
        return FAKE_PS_OUTPUT
    if cmd_lower.startswith("ifconfig") or cmd_lower.startswith("ip addr"):
        return FAKE_IFCONFIG_OUTPUT
    if cmd_lower.startswith("netstat") or cmd_lower.startswith("ss "):
        return FAKE_NETSTAT_OUTPUT

    # Default: return a realistic error
    bin_name = cmd_stripped.split()[0] if cmd_stripped else "command"
    return f"sh: 1: {bin_name}: Permission denied"


class BackdoorBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "backdoor"

    def get_extra_router(self) -> APIRouter:
        router = APIRouter()

        @router.get("/api/exec")
        async def exec_get(request: Request):
            cmd = request.query_params.get("cmd", "")
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "CRITICAL: Shell exec (GET) from %s — cmd=%s", source_ip, cmd
            )
            output = _get_fake_output(cmd)
            return JSONResponse(
                content={
                    "command": cmd,
                    "output": output,
                    "exit_code": 0 if "Permission denied" not in output else 1,
                    "user": "www-data",
                },
                status_code=200,
            )

        @router.post("/api/exec")
        async def exec_post(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            try:
                body = await request.json()
                cmd = body.get("cmd", "")
            except Exception:
                cmd = request.query_params.get("cmd", "")
            logger.warning(
                "CRITICAL: Shell exec (POST) from %s — cmd=%s", source_ip, cmd
            )
            output = _get_fake_output(cmd)
            return JSONResponse(
                content={
                    "command": cmd,
                    "output": output,
                    "exit_code": 0 if "Permission denied" not in output else 1,
                    "user": "www-data",
                },
                status_code=200,
            )

        @router.get("/api/shell")
        async def shell_get(request: Request):
            cmd = request.query_params.get("cmd", "")
            source_ip = request.client.host if request.client else "unknown"
            logger.warning(
                "CRITICAL: Shell access (GET) from %s — cmd=%s", source_ip, cmd
            )
            output = _get_fake_output(cmd)
            return JSONResponse(
                content={
                    "shell": "/bin/sh",
                    "command": cmd,
                    "stdout": output,
                    "stderr": "",
                    "return_code": 0 if "Permission denied" not in output else 126,
                    "cwd": "/var/www",
                },
                status_code=200,
            )

        @router.post("/api/shell")
        async def shell_post(request: Request):
            source_ip = request.client.host if request.client else "unknown"
            try:
                body = await request.json()
                cmd = body.get("cmd", "")
            except Exception:
                cmd = request.query_params.get("cmd", "")
            logger.warning(
                "CRITICAL: Shell access (POST) from %s — cmd=%s", source_ip, cmd
            )
            output = _get_fake_output(cmd)
            return JSONResponse(
                content={
                    "shell": "/bin/sh",
                    "command": cmd,
                    "stdout": output,
                    "stderr": "",
                    "return_code": 0 if "Permission denied" not in output else 126,
                    "cwd": "/var/www",
                },
                status_code=200,
            )

        return router

    def modify_headers(self, headers: dict) -> dict:
        headers["Server"] = "Apache/2.4.41 (Ubuntu)"
        headers["X-Powered-By"] = "PHP/7.4.3"
        return headers
