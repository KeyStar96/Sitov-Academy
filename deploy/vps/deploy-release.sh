#!/usr/bin/env bash
set -euo pipefail
# Run on the VPS after reviewed migrations. Credentials stay outside each release.
SOURCE_DIR=/var/www/sitov-academy
RELEASES_DIR=/var/www/sitov-releases
CURRENT_LINK=/var/www/sitov-current
cd "$SOURCE_DIR"
# Discard only a generated cache if an older checkout still tracks it.
if git ls-files --error-unmatch tsconfig.tsbuildinfo >/dev/null 2>&1; then
  git restore -- tsconfig.tsbuildinfo
fi
git pull --ff-only
REVISION="$(git rev-parse --short=12 HEAD)"
RELEASE_DIR="$RELEASES_DIR/$REVISION"
if [[ -e "$RELEASE_DIR" ]]; then
  echo "Release $REVISION already exists; refusing to overwrite a running build." >&2
  exit 1
fi
install -d -m 755 "$RELEASE_DIR"
git archive HEAD | tar -x -C "$RELEASE_DIR"
install -m 640 -o root -g sitov /etc/sitov-academy/app.env "$RELEASE_DIR/.env.local"
cd "$RELEASE_DIR"
npm ci --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=3072 npm run build
chown -R sitov:sitov "$RELEASE_DIR/.next"
PREVIOUS="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
if [[ -z "$PREVIOUS" ]]; then PREVIOUS="$SOURCE_DIR"; fi
MAIL_RUNNING=false
if systemctl is-active --quiet sitov-mail; then MAIL_RUNNING=true; fi
install -m 644 deploy/vps/sitov-app.service deploy/vps/sitov-mail.service /etc/systemd/system/
ln -s "$RELEASE_DIR" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
systemctl daemon-reload
systemctl restart sitov-app
READY=false
for ((attempt=0;attempt<20;attempt++)); do
  if curl --fail --silent --max-time 4 http://127.0.0.1:3000/api/health >/dev/null; then READY=true;break;fi
  sleep 1
done
if [[ "$READY" != true ]]; then
  ln -s "$PREVIOUS" "$CURRENT_LINK.rollback"
  mv -Tf "$CURRENT_LINK.rollback" "$CURRENT_LINK"
  systemctl restart sitov-app
  echo "Readiness failed; previous release restored." >&2
  exit 1
fi
if [[ "$MAIL_RUNNING" == true ]]; then systemctl restart sitov-mail;fi
printf 'Active release: %s\n' "$REVISION"
