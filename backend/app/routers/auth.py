from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from app.auth import oauth, create_token, get_current_user
from app.config import get_settings
from app.schemas import UserInfo

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.get("/login")
async def login(request: Request):
    if settings.dev_mode:
        return JSONResponse({"message": "Dev mode: auth bypassed", "user": settings.dev_user_email})
    redirect_uri = f"{settings.base_url}/auth/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")

    email = user_info.get("email", "")
    if not email.endswith(f"@{settings.allowed_email_domain}"):
        raise HTTPException(status_code=403, detail="Access restricted to TTB staff (@ttb.gov)")

    session_token = create_token(email=email, name=user_info.get("name", ""))
    response = RedirectResponse(url="/")
    response.set_cookie("session_token", session_token, httponly=True, samesite="lax", secure=not settings.dev_mode)
    return response


@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/")
    response.delete_cookie("session_token")
    return response


@router.get("/me", response_model=UserInfo)
async def me(user: UserInfo = Depends(get_current_user)):
    return user
