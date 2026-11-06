#!/usr/bin/env bash
# (Re)creates the mock CSSD database inside the local container:
# schema → generated seed → read-only login. Safe to re-run; it drops and
# recreates the CSSD database each time.
set -euo pipefail

CONTAINER="${CONTAINER:-cssd-mock-sql}"
SA_PASSWORD="${SA_PASSWORD:-MockCssd#2568dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$HERE/generated/02-seed.sql" ]; then
  echo "missing db/mock/generated/02-seed.sql — run db/mock/generate-seed.mjs first" >&2
  exit 1
fi

# The 2019 image ships sqlcmd under mssql-tools18 (newer CUs) or mssql-tools.
SQLCMD=$(docker exec "$CONTAINER" sh -c 'ls /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd 2>/dev/null | head -1')
if [ -z "$SQLCMD" ]; then
  echo "sqlcmd not found inside $CONTAINER" >&2
  exit 1
fi

run() {
  docker exec "$CONTAINER" "$SQLCMD" -C -b -S localhost -U sa -P "$SA_PASSWORD" "$@"
}

echo "waiting for SQL Server in $CONTAINER..."
for _ in $(seq 1 60); do
  if run -Q "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 2
done
run -Q "SELECT @@VERSION" -h -1 | head -1

for f in 01-schema.sql generated/02-seed.sql 03-readonly-login.sql; do
  echo "→ $f"
  docker cp "$HERE/$f" "$CONTAINER:/tmp/$(basename "$f")" >/dev/null
  run -i "/tmp/$(basename "$f")"
done
echo "done."
