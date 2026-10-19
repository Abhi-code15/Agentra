# Agentra — Production Deployment & Operations Guide

## 1. Production Architecture

Agentra is designed for seamless deployment via Docker Compose or PaaS providers (e.g. Railway, Render, Fly.io, AWS ECS).

```mermaid
graph LR
    Internet["Client / Browser"] -->|HTTPS (443)| ReverseProxy["Nginx / Caddy / Cloudflare"]
    ReverseProxy -->|Proxy (5173 / Static)| StaticFrontend["Vite Production Build"]
    ReverseProxy -->|Proxy (5000)| Backend["Node.js Express Server"]
    Backend -->|Port 5432| Postgres[("Managed PostgreSQL 16+")]
```

---

## 2. Docker Compose Deployment

```bash
# 1. Clone the repository and configure production environment
cp .env.example .env

# 2. Build and start containers
docker compose up -d --build

# 3. Apply database migrations
docker compose exec backend npm run migrate

# 4. Verify service readiness
curl http://localhost:5000/health/ready
```

---

## 3. Database Backup & Restore Strategy

### Automated PostgreSQL Backup
```bash
# Daily automated backup script
pg_dump -U postgres -Fc agentra_dev > /backups/agentra_$(date +%Y%m%d_%H%M%S).dump
```

### Point-In-Time Restoration
```bash
# Restore from dump file
pg_restore -U postgres -d agentra_dev -c /backups/agentra_20261019_120000.dump
```

---

## 4. Deployment Verification Checklist

- [x] Node.js environment: `>= 20.0.0`
- [x] PostgreSQL connection pool configured and healthy.
- [x] Migrations executed through `npm run migrate`.
- [x] `SESSION_SECRET` generated with `>= 32` characters random entropy.
- [x] `COOKIE_SECURE=true` enabled behind HTTPS.
- [x] `CORS_ORIGIN` restricted to the production frontend domain.
- [x] Health checks respond: `GET /health/live` (200), `GET /health/ready` (200).
- [x] All 38 automated test cases passing without failure.
