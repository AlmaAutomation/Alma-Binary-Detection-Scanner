from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SECRET_KEY = "almascan_secret_123"  # Replace with secure env-based value
ALGORITHM = "HS256"

def require_role(required_role):
    def checker(token: str = Depends(oauth2_scheme)):
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            roles = payload.get("roles", [])
            if required_role not in roles:
                raise HTTPException(status_code=403, detail="Insufficient role")
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
    return checker
