#!/bin/sh
set -eu

exec python3 /app/server.py --host 0.0.0.0 --port 8099 --data-dir /data
