#!/usr/bin/env bash
set -euo pipefail
# Run on the VPS. Preparation never switches the live release or restarts services.
# Breaking-schema sequence: --prepare-only -> migrate --keep-stopped ->
# --activate <prepared revision> --schema-changed. Credentials stay outside Git.
SOURCE_DIR="${SITOV_SOURCE_DIR:-/var/www/sitov-academy}"
RELEASES_DIR="${SITOV_RELEASES_DIR:-/var/www/sitov-releases}"
CURRENT_LINK="${SITOV_CURRENT_LINK:-/var/www/sitov-current}"
ENV_FILE="${SITOV_ENV_FILE:-/etc/sitov-academy/app.env}"
SYSTEMD_DIR="${SITOV_SYSTEMD_DIR:-/etc/systemd/system}"
LOCK_FILE="${SITOV_DEPLOY_LOCK_FILE:-/var/lock/sitov-release.lock}"
MODE=deploy
SCHEMA_CHANGED=false
REVISION=
usage() {
  printf 'Usage: %s [--prepare-only | --activate PREPARED_REVISION [--schema-changed]]\n' "$0"
}
while (($#)); do
  case "$1" in
    --prepare-only)
      [[ "$MODE" == deploy ]] || { usage >&2; exit 2; }
      MODE=prepare; shift ;;
    --activate)
      [[ "$MODE" == deploy && $# -ge 2 ]] || { usage >&2; exit 2; }
      MODE=activate; REVISION="$2"; shift 2 ;;
    --schema-changed) SCHEMA_CHANGED=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
if [[ "$SCHEMA_CHANGED" == true && "$MODE" != activate ]]; then
  echo '--schema-changed requires --activate; prepare the build before migrating.' >&2
  exit 2
fi
if [[ "$MODE" == activate && ! "$REVISION" =~ ^[0-9a-f]{12}$ ]]; then
  echo 'A prepared 12-character Git revision is required.' >&2
  exit 2
fi
# Prevent concurrent preparations/activations from sharing temporary links/markers.
exec 9>"$LOCK_FILE"
flock -n 9 || { echo 'Another release operation is running.' >&2; exit 1; }

prepare_release() {
  cd "$SOURCE_DIR"
  # Discard only a generated cache if an older checkout still tracks it.
  if git ls-files --error-unmatch tsconfig.tsbuildinfo >/dev/null 2>&1; then
    git restore -- tsconfig.tsbuildinfo
  fi
  git pull --ff-only
  FULL_REVISION="$(git rev-parse HEAD)"
  REVISION="${FULL_REVISION:0:12}"
  [[ "$FULL_REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid Git revision.' >&2; exit 1; }
  RELEASE_DIR="$RELEASES_DIR/$REVISION"
  if [[ -e "$RELEASE_DIR" ]]; then
    echo "Release $REVISION already exists; refusing to overwrite a prepared/running build." >&2
    exit 1
  fi
  install -d -m 755 "$RELEASE_DIR"
  git archive "$FULL_REVISION" | tar -x -C "$RELEASE_DIR"
  install -m 640 -o root -g sitov "$ENV_FILE" "$RELEASE_DIR/.env.local"
  cd "$RELEASE_DIR"
  npm ci --no-audit --no-fund
  NODE_OPTIONS=--max-old-space-size=3072 npm run build
  test -s .next/BUILD_ID
  test -s .next/required-server-files.json
  chown -R sitov:sitov .next
  cp .next/BUILD_ID .sitov-build-id
  if systemctl is-active --quiet sitov-mail; then
    printf 'true\n' > .sitov-mail-was-running
  else
    printf 'false\n' > .sitov-mail-was-running
  fi
  # Bind the marker to the archived sources and every built artifact. Runtime
  # caches are excluded because Next.js owns them; node_modules is lockfile-built.
  git -C "$SOURCE_DIR" ls-tree -r --name-only -z "$FULL_REVISION" | xargs -0 sha256sum -- > .sitov-prepared.sha256
  find .next -path .next/cache -prune -o -type f -print0 | sort -z | xargs -0 sha256sum -- >> .sitov-prepared.sha256
  sha256sum -- .sitov-build-id .sitov-mail-was-running >> .sitov-prepared.sha256
  chmod 600 .sitov-prepared.sha256 .sitov-build-id .sitov-mail-was-running
  # Publish readiness last, only after build and manifest creation succeeded.
  printf '%s\n' "$FULL_REVISION" > .sitov-prepared.tmp
  chmod 600 .sitov-prepared.tmp
  mv .sitov-prepared.tmp .sitov-prepared
  printf 'Prepared release: %s\n' "$REVISION"
}

activation_failed() {
  local reason="$1"
  if [[ "$SCHEMA_CHANGED" == true ]]; then
    # The old application may be incompatible with the migrated schema.
    systemctl stop sitov-app sitov-mail || true
    printf 'Activation failed (%s). Schema changed: app and mail remain stopped; no automatic rollback. Repair this release or restore the database backup and matching application together. Prepared revision: %s; previous release: %s\n' "$reason" "$REVISION" "$PREVIOUS" >&2
  else
    ln -s "$PREVIOUS" "$CURRENT_LINK.rollback"
    mv -Tf "$CURRENT_LINK.rollback" "$CURRENT_LINK"
    systemctl restart sitov-app || true
    printf 'Activation failed (%s); previous release restored.\n' "$reason" >&2
  fi
  exit 1
}

activate_release() {
  RELEASE_DIR="$RELEASES_DIR/$REVISION"
  # Never infer readiness merely from the directory or .next existing.
  if [[ ! -f "$RELEASE_DIR/.sitov-prepared" || ! -s "$RELEASE_DIR/.sitov-prepared.sha256" ]]; then
    echo "Release $REVISION has no completed preparation marker." >&2
    exit 1
  fi
  IFS= read -r PREPARED_COMMIT < "$RELEASE_DIR/.sitov-prepared"
  if [[ ! "$PREPARED_COMMIT" =~ ^[0-9a-f]{40}$ || "${PREPARED_COMMIT:0:12}" != "$REVISION" ]]; then
    echo 'Prepared revision marker does not match the requested release.' >&2
    exit 1
  fi
  cd "$RELEASE_DIR"
  if ! sha256sum --check --status .sitov-prepared.sha256 || ! cmp -s .sitov-build-id .next/BUILD_ID; then
    echo "Prepared release $REVISION failed artifact verification; refusing activation." >&2
    exit 1
  fi
  PREVIOUS="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  if [[ -z "$PREVIOUS" ]]; then PREVIOUS="$SOURCE_DIR"; fi
  IFS= read -r MAIL_RUNNING < .sitov-mail-was-running
  if systemctl is-active --quiet sitov-mail; then MAIL_RUNNING=true; fi
  [[ "$MAIL_RUNNING" == true || "$MAIL_RUNNING" == false ]] || { echo 'Invalid mail preparation state.' >&2; exit 1; }
  install -m 644 deploy/vps/sitov-app.service deploy/vps/sitov-mail.service "$SYSTEMD_DIR/"
  ln -s "$RELEASE_DIR" "$CURRENT_LINK.next"
  mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
  systemctl daemon-reload || activation_failed 'systemd reload'
  systemctl restart sitov-app || activation_failed 'app startup'
  local ready=false
  for ((attempt=0;attempt<20;attempt++)); do
    if curl --fail --silent --max-time 4 http://127.0.0.1:3000/api/health >/dev/null; then ready=true;break;fi
    sleep 1
  done
  [[ "$ready" == true ]] || activation_failed 'readiness'
  if [[ "$MAIL_RUNNING" == true ]]; then
    systemctl restart sitov-mail || activation_failed 'mail startup'
  fi
  printf 'Active release: %s\n' "$REVISION"
}

if [[ "$MODE" != activate ]]; then prepare_release; fi
if [[ "$MODE" != prepare ]]; then activate_release; fi
