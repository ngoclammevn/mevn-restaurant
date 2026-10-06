#!/usr/bin/env bash
set -euo pipefail
# Isolated PostgreSQL only: no Supabase project URL, credentials, or TCP listener.
projectRoot="$(cd "$(dirname "$0")/../.." && pwd)"
pgBin="${LUNCH_PG_BIN:-/opt/homebrew/opt/postgresql@18/bin}"
pgShare="${LUNCH_PG_SHARE:-$pgBin/../share/postgresql}"
testRoot="$(mktemp -d /private/tmp/lunch-db-check.XXXXXX)"
cleanup() {
  "$pgBin/pg_ctl" -D "$testRoot/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$testRoot"
}
trap cleanup EXIT
mkdir "$testRoot/socket"
"$pgBin/initdb" -D "$testRoot/data" -L "$pgShare" -A trust --no-locale -E UTF8 >"$testRoot/init.log" 2>&1 || { cat "$testRoot/init.log"; exit 1; }
"$pgBin/pg_ctl" -D "$testRoot/data" -l "$testRoot/server.log" -o "-h '' -k $testRoot/socket -p 55439" -w start >/dev/null
psqlCheck() { "$pgBin/psql" -X -h "$testRoot/socket" -p 55439 -d postgres -v ON_ERROR_STOP=1 "$@"; }
psqlCheck -q -f "$projectRoot/tests/database/bootstrap.sql"
for migration in 0001_schema_rls.sql 0002_storage.sql 0003_prod_safe.sql 0004_close_ordering.sql; do
  psqlCheck -q -f "$projectRoot/supabase/migrations/$migration" >"$testRoot/migrations.log" 2>&1
done
psqlCheck -q -f "$projectRoot/tests/database/legacy.sql"
psqlCheck -q -f "$projectRoot/supabase/migrations/20261003070000_close_ordering_compat.sql"
psqlCheck -q -f "$projectRoot/supabase/migrations/20261003080019_lunch_catalog_reviews.sql" >"$testRoot/catalog.log" 2>&1 || { cat "$testRoot/catalog.log"; exit 1; }
psqlCheck -q -f "$projectRoot/tests/database/checks.sql"
