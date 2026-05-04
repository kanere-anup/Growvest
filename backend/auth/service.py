from datetime import datetime, timedelta
import secrets
import hashlib
from typing import Optional, Tuple

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Response, Request, HTTPException, status, Depends

from core.config import settings
from core.database import db_manager, User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token


def generate_refresh_token() -> Tuple[str, str]:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


def set_auth_cookies(response: Response, access_token: str, refresh_token: Optional[str] = None, csrf_token: Optional[str] = None):
    # Access token cookie (HttpOnly)
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=False,  # set True when behind HTTPS
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRES_MINUTES * 60,
        path="/",
    )
    if refresh_token:
        response.set_cookie(
            key=settings.REFRESH_TOKEN_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=settings.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 3600,
            path="/",
        )
    # Non-HttpOnly CSRF token cookie for double-submit pattern
    if csrf_token:
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=csrf_token,
            httponly=False,
            secure=False,
            samesite="lax",
            max_age=settings.ACCESS_TOKEN_EXPIRES_MINUTES * 60,
            path="/",
        )


def clear_auth_cookies(response: Response):
    response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME, path="/")
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")


def get_current_user_from_access_token(request: Request) -> User:
    token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
        email = payload.get("email")
        # Load user
        session = db_manager.get_session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user or not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
            return user
        finally:
            db_manager.close_session(session)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def csrf_protect(request: Request):
    # Enforce double-submit token for state-changing methods
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
        header_token = request.headers.get("x-csrf-token")
        if not cookie_token or not header_token or cookie_token != header_token:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    return None
