#!/usr/bin/env bash
# Idempotent Cloud Agent install script for Sitov Language Academy (SmartGerman).
# Runs after the repository is checked out. Must be safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing npm dependencies (npm ci)"
npm ci

echo "==> Installing Playwright Chromium browser (for e2e tests)"
# System libraries are provided by the base image; only the browser binary is fetched.
# This is a no-op when the matching browser is already cached.
npx --yes playwright install chromium

# Provide non-secret placeholder env vars so `next dev`/`next build` can boot
# out of the box. Real values supplied via the Secrets panel take precedence,
# because process environment variables override .env files in Next.js.
if [ ! -f .env.local ]; then
  echo "==> Writing placeholder .env.local (real Secrets override these at runtime)"
  cat > .env.local <<'EOF'
# Non-secret placeholders so the app boots without real credentials.
# Provide real values via the Cloud Agent Secrets panel to enable the
# Supabase/Stripe/Upstash/SMTP backends.
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
else
  echo "==> .env.local already present; leaving it untouched"
fi

echo "==> Install complete"
