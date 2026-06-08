#!/usr/bin/env bash
set -euo pipefail

# ============================
# Alma Scanner .deb builder
# Usage: ./build_deb.sh 1.0-10
# ============================

VERSION="${1:-1.0-0}"       # e.g. 1.0-10
PKG_NAME="alma-scanner"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKGROOT="$ROOT/pkg"
STAGE="$PKGROOT/${PKG_NAME}_${VERSION}_all"

echo "==> Building ${PKG_NAME} version ${VERSION}"
echo "ROOT    = ${ROOT}"
echo "STAGE   = ${STAGE}"

# 1) Build the React frontend
echo "==> Building React frontend..."
cd "$ROOT/alma-frontend"
npm install
npm run build

# 2) Clean + recreate staging dir
echo "==> Preparing staging directory..."
rm -rf "$STAGE"
mkdir -p "$STAGE/DEBIAN"
mkdir -p "$STAGE/opt/alma-scanner"
mkdir -p "$STAGE/usr/lib/systemd/system"
mkdir -p "$STAGE/usr/share/applications"

# 3) Copy backend + requirements
echo "==> Copying backend + requirements..."
cp "$ROOT/backend.py"        "$STAGE/opt/alma-scanner/backend.py"
cp "$ROOT/requirements.txt"  "$STAGE/opt/alma-scanner/requirements.txt"

# 4) Copy ONLY the built frontend (no src, no node_modules)
echo "==> Copying built frontend..."
if [ ! -d "$ROOT/alma-frontend/build" ]; then
  echo "ERROR: frontend build directory missing. Did npm run build succeed?" >&2
  exit 1
fi
mkdir -p "$STAGE/opt/alma-scanner/alma-frontend"
cp -a "$ROOT/alma-frontend/build" "$STAGE/opt/alma-scanner/alma-frontend/"

# 5) DEBIAN/control
echo "==> Writing DEBIAN/control..."
cat > "$STAGE/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: all
Maintainer: Joshua <you@example.com>
Depends: python3, python3-venv, ca-certificates
Description: Alma Scanner - binary architecture & anomaly scanner
 FastAPI backend + React UI served from /app on port 8002.
EOF

# 6) DEBIAN/postinst
echo "==> Writing DEBIAN/postinst..."
cat > "$STAGE/DEBIAN/postinst" <<'EOF'
#!/bin/bash
set -e

APP_DIR="/opt/alma-scanner"
VENV_DIR="$APP_DIR/venv"

echo "==> Alma Scanner: postinst starting..."

# Create venv if needed
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating virtualenv at $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

# Upgrade pip/setuptools/wheel in the venv
echo "==> Upgrading pip/setuptools/wheel in venv..."
"$VENV_DIR/bin/pip" install --upgrade pip setuptools wheel

# Install app dependencies
echo "==> Installing Python requirements..."
"$VENV_DIR/bin/pip" install --upgrade -r "$APP_DIR/requirements.txt"

# Enable + restart systemd service
echo "==> Enabling alma-scanner.service..."
systemctl daemon-reload || true
systemctl enable alma-scanner.service || true
systemctl restart alma-scanner.service || true

echo "==> Alma Scanner install complete."
EOF
chmod 755 "$STAGE/DEBIAN/postinst"

# 7) DEBIAN/prerm
echo "==> Writing DEBIAN/prerm..."
cat > "$STAGE/DEBIAN/prerm" <<'EOF'
#!/bin/bash
set -e
# Stop/disable service on remove/upgrade
if [ "$1" = "remove" ] || [ "$1" = "upgrade" ]; then
  systemctl stop alma-scanner.service 2>/dev/null || true
  systemctl disable alma-scanner.service 2>/dev/null || true
fi
EOF
chmod 755 "$STAGE/DEBIAN/prerm"

# 8) systemd service
echo "==> Writing systemd service..."
cat > "$STAGE/usr/lib/systemd/system/alma-scanner.service" <<'EOF'
[Unit]
Description=Alma Scanner API (FastAPI + React)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/alma-scanner
ExecStart=/opt/alma-scanner/venv/bin/uvicorn backend:app --host 0.0.0.0 --port 8002
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# 9) Desktop launcher
echo "==> Writing desktop entry..."
cat > "$STAGE/usr/share/applications/alma-scanner.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Alma Scanner
Comment=Scan system binaries and architectures
Exec=xdg-open http://localhost:8002/app/
Icon=utilities-terminal
Terminal=false
Categories=System;Utility;
EOF

# 10) Build .deb
echo "==> Running dpkg-deb..."
mkdir -p "$PKGROOT"
cd "$PKGROOT"
dpkg-deb --build "$(basename "$STAGE")"

echo
echo "============================================"
echo "Built package: $PKGROOT/${PKG_NAME}_${VERSION}_all.deb"
echo "Install with:"
echo "  sudo apt install ./$(basename "$STAGE").deb"
echo "============================================"
