from datetime import datetime, timedelta, timezone
import jwt
import os

SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")
ALGO = "HS256"
ACCESS_MIN = 15
REFRESH_DAYS = 30

def make_access_token(sub: str, roles: list[str], perms: list[str]) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        "sub": sub,
        "roles": roles,
        "perms": perms,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_MIN)).timestamp())
    }, SECRET, algorithm=ALGO)

def make_refresh_token(sub: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        "sub": sub,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=REFRESH_DAYS)).timestamp())
    }, SECRET, algorithm=ALGO)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=[ALGO])
