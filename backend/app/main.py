from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import applications, verifications, decisions, auth as auth_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    import asyncio
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _preload_models)
    yield


def _preload_models():
    print("Loading models...", flush=True)
    from app.services.field_matcher import get_similarity_model
    get_similarity_model()
    import pytesseract
    from PIL import Image
    img = Image.new("RGB", (10, 10), "white")
    pytesseract.image_to_string(img)
    print("Models ready.", flush=True)


app = FastAPI(
    title=settings.app_name,
    description="AI-powered alcohol label verification for TTB compliance agents",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

app.include_router(auth_router.router)
app.include_router(applications.router)
app.include_router(verifications.router)
app.include_router(decisions.router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
