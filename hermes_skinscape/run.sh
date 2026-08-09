#!/usr/bin/with-contenv bashio
set -e

mkdir -p /data/media
exec python3 /app/server.py
