# Alma Modular Backend Migration

This bundle modularizes `AIB_backend_execution_plan_fixed2.py` into FastAPI routes, schemas, scanning, compatibility, execution, ML, storage, and core system modules.

## Run

```bash
cd backend
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Open: http://127.0.0.1:8001/docs

## Compatibility endpoints preserved

- `GET /scan`
- `POST /insight/scan`
- `GET /insight/system`
- `GET /core/capabilities`
- `POST /core/evaluate`
- `POST /ai/scan_and_analyze`
- `POST /execute`
- `GET /cache`, `DELETE /cache`
- EWS endpoints under `/api/ews/*`
