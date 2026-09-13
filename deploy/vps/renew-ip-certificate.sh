#!/bin/sh
set -eu
src=/etc/letsencrypt/live/sitov-ip
dst=/data/coolify/proxy/certs/sitov-ip
install -d -m 700 "$dst"
install -m 644 "$src/fullchain.pem" "$dst/fullchain.pem.new"
install -m 600 "$src/privkey.pem" "$dst/privkey.pem.new"
mv "$dst/fullchain.pem.new" "$dst/fullchain.pem"
mv "$dst/privkey.pem.new" "$dst/privkey.pem"
# The file provider reloads certificates when the dynamic configuration changes.
config=/data/coolify/proxy/dynamic/sitov-ip.yaml
sed '/^# Certificate refresh:/d' "$config" > "$config.new"
printf '\n# Certificate refresh: %s\n' "$(date -u +%s)" >> "$config.new"
mv "$config.new" "$config"
