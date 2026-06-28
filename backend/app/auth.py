from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from jose import jwt, JWTError
from datetime import datetime, timedelta
from app.config import get_settings
from app.schemas import UserInfo

settings = get_settings()

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8


def create_token(email: str, name: str = "") -> str:
    payload = {
        "sub": email,
        "name": name,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_user(request: Request) -> UserInfo:
    # Dev mode: skip OAuth entirely
    if settings.dev_mode:
        return UserInfo(email=settings.dev_user_email, name="Dev Agent")

    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        if not email.endswith(f"@{settings.allowed_email_domain}"):
            raise HTTPException(status_code=403, detail="Access restricted to TTB staff")
        return UserInfo(email=email, name=payload.get("name", ""))
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
