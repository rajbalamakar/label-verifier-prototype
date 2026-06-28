import os
import aiofiles
from pathlib import Path
from app.config import get_settings

settings = get_settings()


async def save_file(file_bytes: bytes, filename: str, subfolder: str = "") -> str:
    """Save uploaded file and return its storage path."""
    if settings.storage_backend == "gcs":
        return await _save_to_gcs(file_bytes, filename, subfolder)
    return await _save_locally(file_bytes, filename, subfolder)


async def _save_locally(file_bytes: bytes, filename: str, subfolder: str) -> str:
    base = Path(settings.upload_dir)
    dest = base / subfolder if subfolder else base
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / filename
    async with aiofiles.open(path, "wb") as f:
        await f.write(file_bytes)
    return str(path)


async def _save_to_gcs(file_bytes: bytes, filename: str, subfolder: str) -> str:
    from google.cloud import storage
    client = storage.Client()
    bucket = client.bucket(settings.gcs_bucket_name)
    blob_name = f"{subfolder}/{filename}" if subfolder else filename
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes)
    return f"gs://{settings.gcs_bucket_name}/{blob_name}"


def get_local_path(storage_path: str) -> str:
    """Resolve a storage path to a local filesystem path for reading."""
    if storage_path.startswith("gs://"):
        raise ValueError("GCS paths require download before local access")
    return storage_path


async def read_file(storage_path: str) -> bytes:
    if storage_path.startswith("gs://"):
        return await _read_from_gcs(storage_path)
    async with aiofiles.open(storage_path, "rb") as f:
        return await f.read()


async def _read_from_gcs(gcs_path: str) -> bytes:
    from google.cloud import storage
    client = storage.Client()
    path = gcs_path.replace("gs://", "")
    bucket_name, blob_name = path.split("/", 1)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    return blob.download_as_bytes()
