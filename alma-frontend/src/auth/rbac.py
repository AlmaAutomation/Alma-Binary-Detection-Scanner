from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def require_permissions(*required: str):
    def checker(token: str = Depends(oauth2_scheme)):
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        token_perms = set(payload.get("perms", []))
        if not set(required).issubset(token_perms):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload  # includes sub/roles/perms
    return checker
