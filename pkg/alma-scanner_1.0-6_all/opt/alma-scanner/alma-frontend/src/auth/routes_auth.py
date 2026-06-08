from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from passlib.hash import bcrypt
import json
from sqlalchemy.orm import Session
from .security import make_access_token, make_refresh_token, decode_token
from .models import User
from ..db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not bcrypt.verify(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    roles = [r.role.name for r in user.roles]
    perms = {p.key for r in user.roles for p in r.role.permissions for p in r.role.permissions}
    
    access = make_access_token(str(user.id), roles, list(perms))
    refresh = make_refresh_token(str(user.id))

    result = {"access_token": access, "token_type": "bearer"}
    response = Response(content=json.dumps(result), media_type="application/json")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="lax")
    return response

@router.post("/refresh")
def refresh(request: Request, db: Session = Depends(get_db)):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = decode_token(rt)
        if payload.get("type") != "refresh":
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).get(int(payload["sub"]))
    roles = [r.role.name for r in user.roles]
    perms = {p.key for r in user.roles for p in r.role.permissions}
    return {"access_token": make_access_token(str(user.id), roles, list(perms)), "token_type": "bearer"}

@router.post("/logout")
def logout():
    response = Response(status_code=204)
    response.delete_cookie("refresh_token")
    return response
