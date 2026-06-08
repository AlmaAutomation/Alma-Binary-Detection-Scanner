from fastapi import APIRouter
from app.scanning.scanner import _CACHE, _CACHE_LOCK

router = APIRouter(tags=["cache"])

@router.get("/cache")
def view_cache():
    with _CACHE_LOCK:
        return {"count": len(_CACHE), "keys": list(_CACHE.keys())[:10]}

@router.delete("/cache")
def clear_cache():
    with _CACHE_LOCK:
        _CACHE.clear()
    return {"detail": "Cache cleared."}

@router.get("/cache/health")
def cache_health():
    return {"module": "cache", "status": "ready"}
