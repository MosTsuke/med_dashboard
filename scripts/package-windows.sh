#!/usr/bin/env bash
# Builds the install bundle for the hospital's Windows machine:
#   dist/med-dashboard-windows-<date>-<commit>.zip
# One folder with the built dashboard (Next.js standalone — no npm on site),
# node.exe for Windows x64, the start/autostart/firewall scripts and a Thai
# install guide (deploy/windows/). Copy it over with AnyDesk and follow
# README-TH.txt. Needs internet here (npm ci, nodejs.org), none on site.
#
#   ./scripts/package-windows.sh
#   NODE_VERSION=24.11.1 ./scripts/package-windows.sh
#
# Built from the files git tracks or would track (working tree, ignored
# files left out), so test/, .env.local, *.bak and the like never get in.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-24.11.1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
CACHE="$DIST/cache"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
DIRTY=""
[ -n "$(git -C "$ROOT" status --porcelain)" ] && DIRTY=" + uncommitted changes"
STAMP="$(date +%Y%m%d)"
OUT="$DIST/med-dashboard-windows-$STAMP-$COMMIT.zip"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src" "$CACHE"

echo "1/5  copying the source ($COMMIT$DIRTY)"
(
  cd "$ROOT"
  git ls-files -z --cached --others --exclude-standard |
    while IFS= read -r -d '' f; do [ -e "$f" ] && printf '%s\0' "$f"; done |
    tar --null -T - -cf - | tar -xf - -C "$WORK/src"
)

echo "2/5  installing packages (npm ci)"
(cd "$WORK/src" && npm ci --no-audit --no-fund --loglevel=error >/dev/null)

echo "3/5  building (standalone)"
if ! (cd "$WORK/src" && STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 npx next build >"$WORK/build.log" 2>&1); then
  tail -40 "$WORK/build.log"
  exit 1
fi

echo "4/5  Node.js $NODE_VERSION for Windows x64"
NODE_ZIP="node-v$NODE_VERSION-win-x64.zip"
if [ ! -f "$CACHE/$NODE_ZIP" ]; then
  curl -fsSL -o "$CACHE/$NODE_ZIP.part" "https://nodejs.org/dist/v$NODE_VERSION/$NODE_ZIP"
  mv "$CACHE/$NODE_ZIP.part" "$CACHE/$NODE_ZIP"
fi
curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" | grep "  $NODE_ZIP\$" >"$CACHE/$NODE_ZIP.sha256"
(cd "$CACHE" && shasum -a 256 -c "$NODE_ZIP.sha256" >/dev/null) || {
  echo "checksum of $NODE_ZIP doesn't match nodejs.org — deleting it, run again"
  rm -f "$CACHE/$NODE_ZIP"
  exit 1
}

echo "5/5  assembling"
B="$WORK/med-dashboard"
mkdir -p "$B/app/.next" "$B/node"
cp -R "$WORK/src/.next/standalone/." "$B/app/"
cp -R "$WORK/src/.next/static" "$B/app/.next/static"
cp -R "$WORK/src/public" "$B/app/public"
rm -f "$B/app/.env" "$B/app/.env."*   # settings come from dashboard.env on site
# Sample/template workbooks are for the (switched-off) Excel import only.
rm -f "$B/app/public/"*.xlsx "$B/app/public/.DS_Store"
unzip -q -j "$CACHE/$NODE_ZIP" "node-v$NODE_VERSION-win-x64/node.exe" "node-v$NODE_VERSION-win-x64/LICENSE" -d "$B/node"
cp -R "$WORK/src/deploy/windows/." "$B/"

# Windows line endings for everything a person or cmd.exe reads; a BOM on
# the .sql so SSMS shows the Thai comments.
find "$B" -maxdepth 2 -type f \( -name '*.bat' -o -name '*.cmd' -o -name '*.ps1' -o -name '*.txt' \
  -o -name '*.sql' -o -name '*.example' \) -not -path "$B/app/*" -not -path "$B/node/*" \
  -exec perl -pi -e 's/\r?\n/\r\n/' {} +
perl -pi -e 's/^/\x{EF}\x{BB}\x{BF}/ if $. == 1' "$B/create-readonly-login.sql"

cat >"$B/VERSION.txt" <<EOF
Med Dashboard
build:   $STAMP
commit:  $COMMIT$DIRTY
node:    v$NODE_VERSION (win-x64)
EOF
perl -pi -e 's/\r?\n/\r\n/' "$B/VERSION.txt"

# Nothing private may ride along.
if find "$B" \( -name '.env.local' -o -name '*.bak' -o -name '*.xlsx' -o -path '*/test/*' \) | grep -q .; then
  echo "refusing: the bundle contains private files:"
  find "$B" \( -name '.env.local' -o -name '*.bak' -o -name '*.xlsx' -o -path '*/test/*' \)
  exit 1
fi

# Windows PowerShell 5.1 reads a .ps1 without a BOM as ANSI: keep them ASCII.
if perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.: $_"; $bad = 1 } close ARGV if eof; END { exit($bad ? 0 : 1) }' "$B"/scripts/*.ps1; then
  echo "refusing: non-ASCII characters in a .ps1 (above)"
  exit 1
fi

rm -f "$OUT"
(cd "$WORK" && zip -qr -X "$OUT" med-dashboard)
echo
echo "done: $OUT ($(du -h "$OUT" | cut -f1))"
