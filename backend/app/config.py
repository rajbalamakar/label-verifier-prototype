from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database — SQLite for local dev, Postgres for Docker/Cloud Run
    database_url: str = "sqlite+aiosqlite:///./labelcheck.db"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    secret_key: str = "dev-secret-key-change-in-production"
    allowed_email_domain: str = "ttb.gov"

    # Storage — local filesystem in dev, GCS in prod
    storage_backend: str = "local"  # "local" or "gcs"
    gcs_bucket_name: str = ""
    upload_dir: str = "../uploads"

    # Tesseract (Windows local dev)
    tesseract_cmd: str = ""
    ocr_backend: str = "tesseract"

    # Force offline mode for HuggingFace models
    transformers_offline: str = "1"
    hf_datasets_offline: str = "1"

    # Dev mode bypasses OAuth (set to false in production)
    dev_mode: bool = True
    dev_user_email: str = "agent@ttb.gov"

    # App
    app_name: str = "TTB LabelCheck"
    base_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
