# Alma End-to-End Demo

This demo exercises a complete live flow through the Alma backend:

1. EWS telemetry snapshot collection
2. CPU spike detection and risk band calculation
3. EWS advisory authorization request
4. Binary scan of `/usr/bin`
5. Alma Core compatibility evaluation
6. Execution policy validation
7. Planned execution using a safe native binary
8. Verification with metrics and cache status

## Requirements

- Backend running at `http://127.0.0.1:8001`
- Python 3.12+ available on the host
- `/usr/bin` accessible from the backend process

## Run the demo

```bash
cd /home/joshua/Desktop/Alma/almasysdet
python3 demo/e2e_demo.py
```

## Optional customization

Override the backend URL or scan path with environment variables:

```bash
ALMA_BACKEND_URL=http://127.0.0.1:8001 ALMA_DEMO_FOLDER=/usr/bin python3 demo/e2e_demo.py
```

## What it demonstrates

- `GET /api/ews/telemetry`
- `POST /api/ews/authorize`
- `GET /scan`
- `POST /core/evaluate`
- `POST /policy/execution`
- `POST /execute`
- `GET /metrics`
- `GET /cache`
