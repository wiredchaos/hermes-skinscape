#!/usr/bin/with-contenv bashio
set -euo pipefail
mkdir -p /data/media
exec python3 /app/server.py
