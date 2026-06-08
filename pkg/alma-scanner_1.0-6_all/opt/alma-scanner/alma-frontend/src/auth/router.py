from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from jose import jwt, JWTError
from passlib.hash import bcrypt

from db import SessionLocal
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = "almascan_secret_123"   # keep in sync with utils.py; ideally use env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def parse_csv(s: str | None) -> list[str]:
    if not s:
        return []
    return [x.strip() for x in s.split(",") if x.strip()]

@router.post("/login")
def login(
    response: Response,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # form.username is the email from the frontend
    user: User | None = db.query(User).filter(User.email == form.username).first()
    if not user or not bcrypt.verify(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    roles = parse_csv(user.roles)
    perms = parse_csv(user.perms)

    access_token = create_token(
        {"sub": user.email, "roles": roles, "perms": perms},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        {"sub": user.email, "type": "refresh"},
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )

    # ✅ Set refresh token via Response helper; let FastAPI handle JSON body/length
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,      # set True in HTTPS
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/auth",
    )
    return {"access_token": access_token}