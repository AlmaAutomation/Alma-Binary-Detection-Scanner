# Alma System Detection - Binary Analysis & Compatibility Platform

Alma is a comprehensive system scanning, binary analysis, and compatibility evaluation platform that provides deep insights into system artifacts, their compatibility with various execution strategies, and real-time telemetry monitoring.

## Features

- **Binary Scanning**: Fast, efficient scanning of system binaries with detailed artifact classification
- **Compatibility Analysis**: Evaluate binary compatibility with multiple execution strategies (native, Wine, QEMU, Docker, etc.)
- **EWS Telemetry**: Real-time system monitoring (CPU, memory, disk, network, processes)
- **Live Demo**: End-to-end demonstration of scanning and evaluation workflow
- **Web Dashboard**: Interactive React-based UI for results visualization and analysis
- **RESTful API**: Complete API for programmatic access to all features
- **Caching**: Intelligent caching system for performance optimization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Alma Scanner Frontend                    │
│                  (React + Tailwind CSS)                     │
│              Running on port 8000 (dev) or 9002             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                      │
│                    (Port 9002)                               │
├─────────────────────────────────────────────────────────────┤
│  Routes:                                                    │
│  • /scan          - Binary scanning endpoints               │
│  • /core          - Compatibility evaluation                │
│  • /execution     - Execution planning                      │
│  • /demo/run      - Full demo workflow                      │
│  • /ews           - EWS telemetry data                      │
│  • /cache         - Cache management                        │
│  • /metrics       - Model metrics                           │
│  • /app           - Frontend static files                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Scanning   │  │  EWS Monitor │  │   Database   │
│   Engine     │  │   Telemetry  │  │   Storage    │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/alma-scanner.git
cd alma-scanner

# Build and start the stack
docker-compose up -d

# Access the application
# Frontend: http://localhost:9002/app
# API docs: http://localhost:9002/docs
```

### Manual Setup

#### Prerequisites
- Python 3.9+
- Node.js 16+ (for frontend development)
- Linux system (for scanning capabilities)

#### Backend Setup

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Start the backend server
cd ..
PYTHONPATH=backend python3 -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 9002 \
  --log-level warning
```

#### Frontend Setup

```bash
# Build production version
cd alma-frontend
npm install
npm run build

# Or run development server
npm start
```

## API Endpoints

### Scanning
- `POST /scan/quick` - Quick scan of specified folder
- `POST /scan/forensic` - Detailed forensic scan (recursive, no cache)
- `GET /scan/status` - Get current scan status

### Compatibility & Analysis
- `POST /core/evaluate` - Evaluate binary compatibility
- `GET /core/strategies` - Get available execution strategies
- `GET /metrics` - Get model metrics (precision, recall, F1)

### Telemetry
- `GET /ews/telemetry` - Get current EWS telemetry snapshot
- `GET /ews/history` - Get telemetry history
- `GET /ews/alerts` - Get security alerts

### Demo
- `POST /demo/run` - Run full demo workflow
  - Returns: selected binary, recommended strategy, execution plan

### Cache
- `GET /cache/stats` - Get cache statistics
- `POST /cache/clear` - Clear the cache

## Configuration

### Environment Variables

```bash
# Backend
export PYTHONPATH=backend
export LOG_LEVEL=warning
export API_HOST=127.0.0.1
export API_PORT=9002

# Frontend (in alma-frontend/)
export REACT_APP_API_BASE=http://localhost:9002
export PUBLIC_URL=/app
```

### Demo Parameters

The `/demo/run` endpoint accepts:
```json
{
  "folder": "/usr/bin",           # Folder to scan
  "arch_filter": "all",           # "all", "32-bit", "64-bit"
  "limit": 200,                   # Max results
  "forensic": false               # Recursive, no cache
}
```

## File Structure

```
almasysdet/
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py                  # App factory
│   │   ├── api/                     # API route handlers
│   │   │   ├── routes_scan.py
│   │   │   ├── routes_core.py
│   │   │   ├── routes_demo.py
│   │   │   ├── routes_ews.py
│   │   │   └── ...
│   │   ├── scanning/                # Binary scanning engine
│   │   ├── core/                    # Compatibility evaluation
│   │   ├── execution/               # Execution planning
│   │   ├── ml/                      # ML models
│   │   └── storage/                 # Data persistence
│   └── requirements.txt
├── alma-frontend/                   # React frontend
│   ├── src/
│   │   ├── App.js                  # Main app routes
│   │   ├── components/             # React components
│   │   ├── api/                    # API client
│   │   └── ...
│   ├── package.json
│   ├── public/
│   └── build/                      # Production build
├── webui/                           # Served frontend (production)
├── ews/                            # EWS telemetry system
├── core/                           # Core evaluation logic
├── data/                           # Cache, models, reports
├── Dockerfile                      # Container image
├── docker-compose.yml              # Multi-container orchestration
└── README.md
```

## Development

### Running Tests

```bash
cd backend
python -m pytest tests/
```

### Linting & Code Quality

```bash
# Format code
black backend/

# Lint
flake8 backend/
```

### Building Frontend for Production

```bash
cd alma-frontend
npm run build
cp -r build/* ../webui/
```

## Deployment

### Docker Hub

```bash
# Build image
docker build -t alma-scanner:latest .

# Push to registry
docker tag alma-scanner:latest yourusername/alma-scanner:latest
docker push yourusername/alma-scanner:latest
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests.

```bash
kubectl apply -f k8s/
```

### System Service (Linux)

Install as a systemd service:

```bash
sudo cp alma-scanner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable alma-scanner
sudo systemctl start alma-scanner
```

## Performance

- **Scan Speed**: ~5,000 binaries/minute on modern hardware
- **Memory**: ~200-500 MB base, scales with scan scope
- **API Latency**: <100ms for cached results
- **Demo Execution**: Full scan + analysis in ~3 seconds

## Security Considerations

- No external network dependencies required
- All data stays local (unless configured otherwise)
- Supports SELinux and AppArmor
- No privileged operations required for scanning

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 9002
lsof -i :9002
# Kill it
kill -9 <PID>
```

### Frontend Not Loading
- Ensure backend is running on port 9002
- Check `webui/` directory exists and contains build files
- Clear browser cache and reload

### Scan Failures
- Ensure adequate permissions for the scan folder
- Check disk space availability
- Review logs: `journalctl -u alma-scanner` (if using systemd)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and commit (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Issues: https://github.com/yourusername/alma-scanner/issues
- Documentation: https://docs.example.com
- Community: https://community.example.com

## Authors

- Core Development Team
- Contributors

## Changelog

### v0.2.0 (Current)
- Live Demo endpoint (/demo/run)
- EWS telemetry integration
- React dashboard UI
- Docker support
- Improved caching system

### v0.1.0
- Initial release
- Binary scanning
- Compatibility evaluation
- REST API
