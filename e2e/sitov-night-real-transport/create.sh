#!/usr/bin/env bash
# M runs only after review/new explicit infra START. Never invoked by the planner.
set -euo pipefail
umask 077
cd "$(dirname "$0")"
python3 inspect.py > facts-now.json
python3 guard.py facts-now.json
compose=(docker compose --project-name sitov-night-20261008-qa --file compose.json)
"${compose[@]}" up -d --pull never db
ready=0
for attempt in {1..30}; do
 if docker exec sitov-night-20261008-qa-db pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=1;break;fi
 sleep 2
done
test "$ready" = 1
# Real cached image vendor prerequisites must exist; never replace them with mocks.
docker exec sitov-night-20261008-qa-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN RAISE EXCEPTION 'vendor_bootstrap_missing'; END IF; END \$\$;" >/dev/null
docker exec -i sitov-night-20261008-qa-db psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < new-roles.sql >/dev/null
"${compose[@]}" up -d --pull never auth rest storage gateway
# No schema fixtures, accounts, audio or application acceptance run here.
printf '%s\n' 'Services created; actual Auth/Storage health and bundle-install gate still pending.'
