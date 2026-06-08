# --- adjust these if your paths differ ---
BDS_DIR="$HOME/Desktop/almasysdet/alma-frontend/src/components"
BDS_MAIN="$(realpath "$BDS_DIR/AlmaScanDashboard.jsx")"   # <— change filename if needed
ICON_SRC="$BDS_DIR/bds.png"                           # any PNG; falls back if missing
ICON_DST="$HOME/.local/share/icons/alma-bds.png"
PYTHON="$(command -v python3)"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
DESK_DIR="$HOME/.local/share/applications"

# Set to 1 if your scanner is CLI (needs a terminal); 0 if it opens its own GUI
BDS_IS_CLI=0

# --- sanity checks ---
[ -x "$PYTHON" ] || { echo "python3 not found"; exit 1; }
[ -f "$BDS_MAIN" ] || { echo "Scanner script not found: $BDS_MAIN"; exit 1; }
mkdir -p "$DESK_DIR" "$(dirname "$ICON_DST")"
[ -f "$ICON_SRC" ] && cp -f "$ICON_SRC" "$ICON_DST" || ICON_DST=""

TERM_FLAG=$([ "$BDS_IS_CLI" -eq 1 ] && echo true || echo false)

# --- Desktop icon (normal) ---
cat > "$DESKTOP_DIR/Binary Detection Scanner.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Binary Detection Scanner
Comment=Scan binaries for anomalies
Exec=$PYTHON $BDS_MAIN
Icon=$ICON_DST
Terminal=$TERM_FLAG
Categories=Utility;System;Security;
StartupNotify=true
EOF
chmod +x "$DESKTOP_DIR/Binary Detection Scanner.desktop"
gio set "$DESKTOP_DIR/Binary Detection Scanner.desktop" metadata::trusted true 2>/dev/null || true

# --- App Grid launcher (normal) ---
cat > "$DESK_DIR/alma-bds.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Binary Detection Scanner
Comment=Scan binaries for anomalies
Exec=$PYTHON $BDS_MAIN
Icon=$ICON_DST
Terminal=$TERM_FLAG
Categories=Utility;System;Security;
StartupNotify=true
EOF
chmod +x "$DESK_DIR/alma-bds.desktop"

# --- Admin wrapper (pkexec) ---
mkdir -p "$HOME/bin"
cat > "$HOME/bin/bds-admin" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP="$HOME/Desktop/Alma/binary_scanner.py"   # <— change if needed
exec pkexec env \
  DISPLAY="$DISPLAY" \
  XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}" \
  WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}" \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$UID}" \
  DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
  python3 "$APP"
EOF
chmod +x "$HOME/bin/bds-admin"

# --- Desktop icon (Admin) ---
cat > "$DESKTOP_DIR/Binary Detection Scanner (Admin).desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Binary Detection Scanner (Admin)
Comment=Run scanner with admin rights
Exec=$HOME/bin/bds-admin
Icon=$ICON_DST
Terminal=false
Categories=Utility;System;Security;
StartupNotify=true
EOF
chmod +x "$DESKTOP_DIR/Binary Detection Scanner (Admin).desktop"
gio set "$DESKTOP_DIR/Binary Detection Scanner (Admin).desktop" metadata::trusted true 2>/dev/null || true

# --- App Grid launcher (Admin) ---
cat > "$DESK_DIR/alma-bds-admin.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Binary Detection Scanner (Admin)
Comment=Run scanner with admin rights
Exec=$HOME/bin/bds-admin
Icon=$ICON_DST
Terminal=false
Categories=Utility;System;Security;
StartupNotify=true
EOF
chmod +x "$DESK_DIR/alma-bds-admin.desktop"

# refresh desktop DB (harmless if not present)
desktop-file-validate "$DESK_DIR/alma-bds.desktop" 2>/dev/null || true
desktop-file-validate "$DESK_DIR/alma-bds-admin.desktop" 2>/dev/null || true
update-desktop-database "$DESK_DIR" 2>/dev/null || true

echo "Done. Look on your Desktop and in your app grid for:
 - Binary Detection Scanner
 - Binary Detection Scanner (Admin)"

