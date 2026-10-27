# Deployment & infrastructure

Production host: `147.93.31.140` (Ubuntu, Hostinger KVM 4).

This directory holds the configuration that lives **outside** the application code.
Everything here is a copy of what is actually installed on the server — if you
change something on the box, update the matching file here in the same commit.

## What runs where

```
                        ┌──────────────────────────────────────────┐
  :80 / :443  ────────► │ host nginx (systemd) — the ONLY proxy    │
                        └───────────────┬──────────────────────────┘
                                        │
   mstechind.com / www.mstechind.com ───┼──► PHP 8.3 FPM → Laravel mstVts
                                        │    /var/www/laravel/mstVts
                                        │
   *.mstechind.com  (regex vhost) ──────┼──► 127.0.0.1:3000  Next.js frontend
                                        │    /api/       → 127.0.0.1:4000 (NestJS)
                                        │    /socket.io/ → 127.0.0.1:4000 (WebSocket)
                                        │
   :9090 ──────────────────────────────────► phpMyAdmin (separate vhost)
   :20000 ─────────────────────────────────► PM2 `e101-tcp` GPS ingest (raw TCP)
```

Docker (compose project `nexus-fleet`, checked out at `/opt/nexus-fleet`) runs
`postgres`, `redis`, `backend`, `frontend`, `osrm`. **All published ports are
bound to `127.0.0.1`** — nothing except nginx, sshd, phpMyAdmin and the GPS
ingest is reachable from the internet.

> There is deliberately **no nginx container**. An earlier containerised nginx
> could never bind 80/443 (the host nginx owns them), so it sat in a restart
> loop (9,647 restarts) with no networks attached. Do not re-add one.

## Files

| File | Installed at |
| --- | --- |
| `nginx/mstVts.conf` | `/etc/nginx/sites-available/mstVts` |
| `nginx/nexus-fleet.conf` | `/etc/nginx/sites-available/nexus-fleet` |
| `scripts/nexus-healthcheck.sh` | `/usr/local/bin/nexus-healthcheck.sh` |

Both vhosts are symlinked into `/etc/nginx/sites-enabled/`.

Install:

```bash
install -m 644 deploy/nginx/mstVts.conf        /etc/nginx/sites-available/mstVts
install -m 644 deploy/nginx/nexus-fleet.conf   /etc/nginx/sites-available/nexus-fleet
ln -sf /etc/nginx/sites-available/mstVts      /etc/nginx/sites-enabled/mstVts
ln -sf /etc/nginx/sites-available/nexus-fleet /etc/nginx/sites-enabled/nexus-fleet
install -m 755 deploy/scripts/nexus-healthcheck.sh /usr/local/bin/nexus-healthcheck.sh
nginx -t && systemctl reload nginx
```

## Hostname routing rules

`admin`, `www`, `app`, `api`, `fleet` are **reserved** subdomains — they are not
tenants. The list is duplicated in three places and must stay in sync:

- `src/lib/tenant-host.ts` → `RESERVED_SUBDOMAINS` (browser)
- `backend/src/common/middleware/tenant-resolver.middleware.ts` (API)
- the nginx regex vhost matches any `<slug>` and forwards it; the app decides

Anything else under `*.mstechind.com` is treated as a tenant slug and must exist
in the `tenants` table.

## TLS

Wildcard `mstechind.com` + `*.mstechind.com`, ECDSA P-256, issued by
Let's Encrypt through **acme.sh with the `dns_hostinger` provider** (DNS-01 —
wildcards cannot be validated over HTTP).

- acme.sh home: `/root/.acme.sh` (cert `mstechind.com_ecc`)
- installed to: `/etc/ssl/mstechind/{fullchain,privkey}.pem`
- nginx reads those two paths in both vhosts
- renewal: cron `17 4,10,16,22 * * *` runs `acme.sh --cron`, which re-runs
  `systemctl reload nginx` via the stored `Le_ReloadCmd`
- provider credential is stored in `~/.acme.sh/account.conf` as
  `HOSTINGER_Token` (Hostinger hPanel → Account → API)

`certbot` is no longer used: its renewal config used the `manual` authenticator,
which cannot renew unattended. `certbot.timer` is disabled — do not re-enable it.

Verify:

```bash
~/.acme.sh/acme.sh --list
openssl s_client -connect 127.0.0.1:443 -servername mstechind.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -enddate
```

## GPS ingest (PM2, outside Docker)

`e101-tcp` at `/var/www/node/e101-tcp-server` listens on TCP 20000 and writes
each frame to the Redis stream `gps:telemetry:stream`, which the NestJS backend
consumes into `gps_readings`.

Two local modifications to `server.js` (not in this repo):

1. `REDIS_PASSWORD` in `.env` must match the value in `/opt/nexus-fleet/.env`
   (a mismatch causes silent `WRONGPASS` and total telemetry loss).
2. The `XADD` is capped, so the stream cannot grow without bound:

   ```js
   redis.xadd(STREAM_KEY, 'MAXLEN', '~', 100000, '*', 'payload', payload)
   ```

   Without the cap the stream reached 3.7 M entries / 2.6 GB.

`tcp-server` exists in `docker-compose.yml` but is behind the `docker-ingest`
profile and disabled, because PM2 owns port 20000.

## Telemetry consumer PEL

The backend reads the stream with `XREADGROUP ... '>'`, so a delivered message
that is never `XACK`ed stays in the consumer group's pending entries list (PEL)
**forever** — it is never re-delivered and nothing retries it. The group only
sees new entries.

Entries accumulate from two sources:

1. Messages the consumer deliberately skips — invalid GPS fix, unknown IMEI,
   missing fields. Nothing is lost, they are just never acknowledged.
2. A batch that was delivered but never written, e.g. a backend restart or
   crash mid-batch. These are real readings, recoverable only while the entry
   is still inside the stream (`XTRIM MAXLEN ~ 100000` deletes the oldest).

`backend/src/scripts/pel-cleanup.ts` (compiled to `dist/scripts/pel-cleanup.js`)
walks the PEL, replays whatever is still in the stream through the same
validation + insert path as the consumer, then acknowledges everything. Redis 7
drops the already-trimmed ids automatically during `XAUTOCLAIM`.

```bash
# report only, changes nothing
docker exec nexus-fleet-backend-1 node dist/scripts/pel-cleanup.js

# replay survivors and drain the PEL
docker exec nexus-fleet-backend-1 node dist/scripts/pel-cleanup.js --apply

# check
docker exec nexus-fleet-redis-1 redis-cli -a "$REDIS_PASSWORD" --no-auth-warning \
  xpending gps:telemetry:stream nestjs-telemetry-group
```

`PEL_MIN_IDLE_MS` (default `300000`, 5 minutes) keeps in-flight batches out of
reach, so the drain never races the live consumer.

## Health watchdog

`scripts/nexus-healthcheck.sh` runs from cron every 5 minutes and checks:

- `https://mstechind.com/` (Laravel)
- `https://admin.mstechind.com/login`
- `https://ranaghat.mstechind.com/login`
- the public tenant API
- containers in `restarting` / `exited` state
- containers that restarted in the last 15 minutes (crash loop)
- GPS stream freshness (fails if the newest entry is older than 10 minutes)
- PM2 `e101-tcp` is running
- root disk below 85%

It always writes `/var/run/nexus-health.status` (`OK <ts>` / `FAIL <ts> :: …`)
and appends failures to `/var/log/nexus-health.log` + syslog tag `nexus-health`.

```bash
cat /var/run/nexus-health.status
tail -20 /var/log/nexus-health.log
```

The watchdog only detects — it never restarts anything. Pair it with an external
monitor (UptimeRobot or similar) on the three public URLs, so an outage pages
someone instead of being discovered days later.

## Database indexes

TypeORM runs with `synchronize: true`, which **drops any index it does not know
about** on every boot. Indexes created by hand with `psql` therefore disappear
the next time the API restarts — declare them with `@Index` on the entity
instead (`backend/src/gps-devices/gps-reading.entity.ts`).

On `gps_readings` (~3.4M rows) the indexes are:

| Index | Purpose |
| --- | --- |
| `idx_readings_device_timestamp` on `("deviceId", "timestamp")` | newest reading per device; also the GPS cleaner and per-device reports |
| `idx_readings_unprocessed` on `("timestamp") WHERE processed = false` | GPS cleaner backfill queue |

There is deliberately **no plain `("timestamp")` index**. With one, Postgres
plans "newest reading for device X" as a backward scan of the whole timestamp
index, discarding ~340k rows per device that stopped reporting — 2.6s per
live-map poll and ~68M index tuples read per request. Without it the planner
uses the `("deviceId", "timestamp")` prefix and the same query takes 0.02s.
The cost is that the unfiltered telemetry list (global `ORDER BY timestamp`)
sorts instead of using an index: ~1.7s for a page that is normally used with
a date filter.

## Deploying application changes

```bash
git push origin main
ssh root@147.93.31.140 'cd /opt/nexus-fleet && git pull && docker compose up -d --build'
```

`.env` files are **not** in this repo. Keep a copy of `/opt/nexus-fleet/.env`
and `/var/www/node/e101-tcp-server/.env` in a password manager.
