from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi import Header
from pydantic import EmailStr
from loguru import logger
from core.config import settings
from core.database import db_manager, User
from auth.schemas import RegisterRequest, LoginRequest, UserOut
from auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user_from_access_token,
)

from sqlalchemy.exc import SQLAlchemyError

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/register", response_model=UserOut)
def register(payload: RegisterRequest):
    existing = db_manager.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    pw_hash = hash_password(payload.password)
    user_id = db_manager.create_user(
        email=str(payload.email),
        password_hash=pw_hash,
        full_name=payload.full_name or None,
    )
    session = db_manager.get_session()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User Creating Failed",
            )
        return UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_verified=user.is_verified,
        )
    except SQLAlchemyError as db_err:
        logger.exception(f"Database error during registration {db_err}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occured, Please try again",
        )
    except Exception as e:
        logger.exception(f"Unexpected error occured during registration {e}")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occured during registration",
        )
    finally:
        db_manager.close_session(session)


@auth_router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response):
    # Authenticate
    session = db_manager.get_session()
    try:
        user = session.query(User).filter(User.email == str(payload.email)).first()
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User disabled"
            )
    finally:
        db_manager.close_session(session)

    access_token = create_access_token(user_id=user.id, email=user.email)
    refresh_token, token_hash = generate_refresh_token()
    # Persist refresh session
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
    ua = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    db_manager.create_refresh_session(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=ua,
        ip_address=ip,
    )

    # CSRF token for double-submit on unsafe methods
    csrf_token = secrets.token_urlsafe(24)
    set_auth_cookies(
        response,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
    )
    return {"message": "Logged in"}


@auth_router.post("/refresh")
def refresh_token_endpoint(request: Request, response: Response):
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token"
        )
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    rs = db_manager.get_refresh_session(token_hash)
    if not rs or rs.revoked_at is not None or rs.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Load user
    session = db_manager.get_session()
    try:
        user = session.query(User).filter(User.id == rs.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user"
            )
    finally:
        db_manager.close_session(session)

    # Rotate refresh token
    new_refresh_token, new_hash = generate_refresh_token()
    db_manager.revoke_refresh_session(token_hash, replaced_by=new_hash)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
    ua = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    db_manager.create_refresh_session(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=expires_at,
        user_agent=ua,
        ip_address=ip,
    )

    # Issue new access token and set cookies
    access_token = create_access_token(user_id=user.id, email=user.email)
    csrf_token = secrets.token_urlsafe(24)
    set_auth_cookies(
        response,
        access_token=access_token,
        refresh_token=new_refresh_token,
        csrf_token=csrf_token,
    )
    return {"message": "Refreshed"}


@auth_router.post("/logout")
def logout(request: Request, response: Response):
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        db_manager.revoke_refresh_session(token_hash)
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@auth_router.get("/me", response_model=UserOut)
def me(request: Request):
    user = get_current_user_from_access_token(request)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_verified=user.is_verified,
    )
