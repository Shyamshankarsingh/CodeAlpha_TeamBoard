# Production Deployment & Operations Runbook

**TeamBoard** is designed as a single-process, low-overhead, high-performance collaborative project management system backed by an embedded SQLite database in WAL (Write-Ahead Logging) mode.

---

## 1. System Requirements

- **Node.js:** v20.x or v22.x LTS.
- **Operating System:** Linux (Ubuntu 22.04+ / Debian 12+ recommended), macOS, or Windows Server.
- **Memory:** Minimum 512MB RAM, 1GB+ recommended.
- **Disk:** Fast SSD storage with sufficient space for the SQLite database and automated backups.

---

## 2. Environment Configuration

Copy `.env.example` to `.env` or set environment variables in your orchestrator:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Environment mode (`production`, `development`, `test`). |
| `PORT` | No | `3000` | Port the Node HTTP server listens on. |
| `APP_ORIGIN` | Yes | — | Canonical URL (e.g. `https://teamboard.example.com`). In production, **must** use HTTPS. |
| `DATABASE_PATH` | No | `data/teamboard.db` | Path to persistent SQLite database file. |
| `SESSION_IDLE_DAYS` | No | `7` | Days before an inactive session expires. |
| `SESSION_MAX_DAYS` | No | `30` | Absolute maximum lifespan of a session. |
| `COOKIE_SECURE` | Yes | `true` | Requires HTTPS cookies. Must be `true` in production. |
| `REQUIRE_EMAIL_VERIFICATION` | No | `false` | When true, new users must verify email before logging in. |
| `MAIL_TRANSPORT` | No | `console` | `console` or `smtp`. |
| `SMTP_HOST` | If smtp | — | SMTP server hostname. |
| `SMTP_PORT` | If smtp | `587` | SMTP port. |
| `SMTP_USER` | If smtp | — | SMTP username. |
| `SMTP_PASS` | If smtp | — | SMTP password. |
| `SMTP_FROM` | If smtp | — | Sender address (e.g. `TeamBoard <noreply@example.com>`). |

---

## 3. Docker Deployment

### 3.1 Build & Run with Docker

```bash
# Build production container image
docker build -t teamboard:latest .

# Run container with persistent data volumes
docker run -d \
  --name teamboard \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e APP_ORIGIN=https://teamboard.example.com \
  -e COOKIE_SECURE=true \
  -v /var/lib/teamboard/data:/app/data \
  -v /var/lib/teamboard/backups:/app/backups \
  teamboard:latest
```

---

## 4. Nginx Reverse Proxy Configuration

Nginx terminates TLS/SSL and proxies HTTP and WebSocket traffic to TeamBoard:

```nginx
server {
    listen 80;
    server_name teamboard.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name teamboard.example.com;

    ssl_certificate /etc/letsencrypt/live/teamboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/teamboard.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 5. Automated Database Backups

TeamBoard includes an automated online backup script utilizing SQLite's WAL non-blocking backup API:

```bash
# Manual backup execution
npm run backup
```

### 5.1 Automated Daily Cron Job

Add a cron job to run daily backups at 02:00 AM:

```bash
0 2 * * * cd /opt/teamboard && /usr/bin/node scripts/backup.js >> /var/log/teamboard-backup.log 2>&1
```

- Creates timestamped backups in `backups/teamboard-backup-YYYY-MM-DDTHH-mm-ss.db`.
- Verifies backup integrity immediately via `PRAGMA integrity_check`.
- Automatically prunes older backups, retaining the 10 most recent snapshots.

---

## 6. Disaster Recovery & Database Restoration

To restore from a backup:

1. Stop the application server:
   ```bash
   sudo systemctl stop teamboard  # or docker stop teamboard
   ```
2. Replace the active database file with the backup snapshot:
   ```bash
   cp backups/teamboard-backup-YYYY-MM-DDTHH-mm-ss.db data/teamboard.db
   rm -f data/teamboard.db-wal data/teamboard.db-shm
   ```
3. Restart the application:
   ```bash
   sudo systemctl start teamboard  # or docker start teamboard
   ```

---

## 7. Health Checks & Monitoring

- **Liveness probe:** `GET /api/health` returns HTTP 200 `{ "status": "ok" }`.
- **Readiness probe:** `GET /api/health/ready` verifies:
  - Database connectivity (`SELECT 1`).
  - Active SQLite WAL mode.
  - Process uptime and memory statistics.
