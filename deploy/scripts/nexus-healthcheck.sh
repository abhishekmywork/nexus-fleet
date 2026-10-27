#!/usr/bin/env bash
# Nexus Fleet health watchdog
# Installed at /usr/local/bin/nexus-healthcheck.sh, run every 5 minutes by cron.
#
# Writes a status file on every run and appends to the log only when something
# is wrong, so `tail /var/log/nexus-health.log` stays quiet while healthy.

set -uo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

LOG=/var/log/nexus-health.log
STATUS=/var/run/nexus-health.status
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FAIL=0
PROBLEMS=""

add() { PROBLEMS="${PROBLEMS}${PROBLEMS:+; }$1"; FAIL=1; }

check_url() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  [ "$code" != "$expect" ] && add "$name HTTP ${code:-none} (expected $expect)"
}

# --- public endpoints -------------------------------------------------------
check_url apex   https://mstechind.com/
check_url admin  https://admin.mstechind.com/login
check_url tenant https://ranaghat.mstechind.com/login
check_url api    https://admin.mstechind.com/api/tenants/public/by-slug/ranaghat

# --- container restart loops / dead containers ------------------------------
RESTARTING=$(docker ps --filter "status=restarting" --format '{{.Names}}' 2>/dev/null)
[ -n "$RESTARTING" ] && add "containers restarting: $(echo "$RESTARTING" | tr '\n' ' ')"

EXITED=$(docker ps -a --filter "status=exited" --format '{{.Names}}' 2>/dev/null | grep -E '^nexus-fleet-' || true)
[ -n "$EXITED" ] && add "containers exited: $(echo "$EXITED" | tr '\n' ' ')"

# Crash loops: a container that restarted and came back within the last 15 min.
# `docker ps` shows "Up 12 seconds" for these, which is easy to miss.
NOW=$(date +%s)
for name in $(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^nexus-fleet-'); do
  restarts=$(docker inspect -f '{{.RestartCount}}' "$name" 2>/dev/null || echo 0)
  started=$(docker inspect -f '{{.State.StartedAt}}' "$name" 2>/dev/null || true)
  [ -z "$started" ] && continue
  started_s=$(date -d "$started" +%s 2>/dev/null || echo 0)
  age=$(( NOW - started_s ))
  if [ "${restarts:-0}" -gt 0 ] && [ "$age" -lt 900 ]; then
    add "$name crash-looping (${restarts} restarts, up ${age}s)"
  fi
done

# --- GPS ingest freshness ---------------------------------------------------
PW=$(grep '^REDIS_PASSWORD=' /opt/nexus-fleet/.env 2>/dev/null | cut -d= -f2-)
if [ -n "$PW" ]; then
  LAST_ID=$(docker exec nexus-fleet-redis-1 redis-cli --raw -a "$PW" --no-auth-warning \
            xrevrange gps:telemetry:stream + - COUNT 1 2>/dev/null | head -1)
  if [ -n "$LAST_ID" ]; then
    LAST_MS=${LAST_ID%%-*}
    NOW_MS=$(( $(date +%s) * 1000 ))
    AGE=$(( (NOW_MS - LAST_MS) / 1000 ))
    [ "$AGE" -gt 600 ] && add "GPS stream stale ${AGE}s (no telemetry)"
  else
    add "GPS stream unreadable"
  fi
else
  add "REDIS_PASSWORD missing from /opt/nexus-fleet/.env"
fi

# --- ingest process ---------------------------------------------------------
pm2 pid e101-tcp 2>/dev/null | grep -qE '^[0-9]+$' || add "PM2 e101-tcp not running"

# --- disk -------------------------------------------------------------------
DISK=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${DISK:-0}" -gt 85 ] && add "disk ${DISK}% used"

# --- report -----------------------------------------------------------------
if [ "$FAIL" -eq 0 ]; then
  echo "OK $TS" > "$STATUS"
else
  echo "FAIL $TS :: $PROBLEMS" > "$STATUS"
  echo "$TS FAIL :: $PROBLEMS" >> "$LOG"
  logger -t nexus-health "FAIL: $PROBLEMS"
fi

exit "$FAIL"
