#!/bin/bash
# Alma Scanner - Start Script (Manual/Development)

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Alma Scanner...${NC}"

# Check if backend dependencies are installed
if [ ! -d "backend/.venv" ] && [ ! -d ".venv" ]; then
    echo "Installing Python dependencies..."
    pip install -r backend/requirements.txt
fi

# Build frontend if not built
if [ ! -d "webui/static" ]; then
    echo "Building frontend..."
    cd alma-frontend
    npm install
    npm run build
    cd ..
    cp -r alma-frontend/build/* webui/
fi

# Start backend
echo -e "${GREEN}[✓] Starting backend on port 9002...${NC}"
export PYTHONPATH=backend

# Use nohup to keep running in background
nohup python3 -m uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 9002 \
    --log-level warning > alma.log 2>&1 &

BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}[✓] Backend started (PID: $BACKEND_PID)${NC}"
else
    echo "Backend failed to start. Check alma.log for errors"
    cat alma.log
    exit 1
fi

echo ""
echo -e "${GREEN}=== Alma Scanner Running ===${NC}"
echo ""
echo "Frontend:  http://localhost:9002/app"
echo "API Docs:  http://localhost:9002/docs"
echo ""
echo "Logs:      tail -f alma.log"
echo ""
echo "Stop with: kill $BACKEND_PID"
echo ""

# Keep script running and show logs
tail -f alma.log &
TAIL_PID=$!

# Trap to clean up on exit
cleanup() {
    echo ""
    echo "Stopping Alma Scanner..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $TAIL_PID 2>/dev/null || true
}

trap cleanup EXIT

# Wait for signals
wait
