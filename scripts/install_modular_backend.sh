#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="${1:-$PWD}"
cd "$PROJECT_DIR"
mkdir -p legacy
for f in AIB_backend*.py Almacloud_BE.py; do
  if [ -f "$f" ]; then cp -n "$f" legacy/ || true; fi
done
cp -R backend/app backend/app.bak.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
cp -R "$(dirname "$0")/../backend" ./
echo "Modular backend installed. Run: cd backend && uvicorn app.main:app --reload --port 8001"
