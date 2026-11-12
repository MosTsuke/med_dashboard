#!/usr/bin/env bash
# Restores a .bak from the hospital (e.g. CSSD_Export.bak made by
# db/export/export-for-dashboard.sql) into the local container AS "CSSD",
# replacing the mock, then re-grants the read-only dashboard login.
#
#   ./db/mock/restore-bak.sh ~/Downloads/CSSD_Export.bak
#
# To go back to the mock data afterwards: ./db/mock/load.sh
set -euo pipefail

BAK="${1:?usage: restore-bak.sh <file.bak>}"
CONTAINER="${CONTAINER:-cssd-mock-sql}"
SA_PASSWORD="${SA_PASSWORD:-MockCssd#2568dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"

SQLCMD=$(docker exec "$CONTAINER" sh -c 'ls /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd 2>/dev/null | head -1')
run() { docker exec "$CONTAINER" "$SQLCMD" -C -b -S localhost -U sa -P "$SA_PASSWORD" "$@"; }

docker exec "$CONTAINER" mkdir -p /var/opt/mssql/backup
docker cp "$BAK" "$CONTAINER:/var/opt/mssql/backup/restore.bak"

# Logical file names differ per source database — read them from the backup.
FILES=$(run -h -1 -W -s '|' -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/restore.bak'" | awk -F'|' 'NF > 2 { print $1 "|" $3 }')
MOVES=""
while IFS='|' read -r logical type; do
  [ -z "$logical" ] && continue
  if [ "$type" = "L" ]; then ext="_log.ldf"; else ext=".mdf"; fi
  MOVES="$MOVES, MOVE N'$logical' TO N'/var/opt/mssql/data/CSSD_${logical}${ext}'"
done <<< "$FILES"

echo "restoring $(basename "$BAK") as CSSD..."
run -Q "IF DB_ID(N'CSSD') IS NOT NULL ALTER DATABASE CSSD SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        RESTORE DATABASE CSSD FROM DISK = N'/var/opt/mssql/backup/restore.bak' WITH REPLACE${MOVES};
        ALTER DATABASE CSSD SET MULTI_USER;"

# A full hospital backup carries secrets/personal data the dashboard never
# needs (passwords, staff names, patient HN, free-text notes) — blank them
# in this local copy. Columns that don't exist are skipped.
docker cp "$HERE/04-scrub-personal-data.sql" "$CONTAINER:/tmp/04-scrub-personal-data.sql"
run -d CSSD -i /tmp/04-scrub-personal-data.sql

docker cp "$HERE/03-readonly-login.sql" "$CONTAINER:/tmp/03-readonly-login.sql"
run -i /tmp/03-readonly-login.sql >/dev/null

echo "tables now in CSSD:"
run -h -1 -W -Q "SET NOCOUNT ON; SELECT t.name + ': ' + CAST(SUM(p.rows) AS varchar(20)) FROM CSSD.sys.tables t JOIN CSSD.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) GROUP BY t.name ORDER BY t.name"
