"""
OCR service — uses pytesseract for local dev (Python 3.13 compatible).
PaddleOCR is used in Docker/prod (see Dockerfile) where Python 3.11 is pinned.
Set OCR_BACKEND=paddle in env to force PaddleOCR.
"""
import re
import io
import os
from typing import Optional
from PIL import Image, ImageFilter, ImageEnhance

from app.config import get_settings as _get_settings
_settings = _get_settings()

OCR_BACKEND = _settings.ocr_backend

# Configure Tesseract binary path (required on Windows)
if _settings.tesseract_cmd:
    import pytesseract as _pt
    _pt.pytesseract.tesseract_cmd = _settings.tesseract_cmd


def preprocess_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    if w < 800:
        scale = 800 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    # Add white padding so edge text isn't clipped during OCR
    padded = Image.new("RGB", (img.width + 40, img.height + 40), "white")
    padded.paste(img, (20, 20))
    img = padded
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    return img


def extract_text_from_image(image_bytes: bytes) -> str:
    img = preprocess_image(image_bytes)
    if OCR_BACKEND == "paddle":
        return _paddle_ocr(image_bytes)
    return _tesseract_ocr(img)


def _tesseract_ocr(img: Image.Image) -> str:
    import pytesseract
    # psm 11 = sparse text, handles labels with mixed font sizes well
    return pytesseract.image_to_string(img, config="--psm 11 --oem 3")


def _paddle_ocr(image_bytes: bytes) -> str:
    from paddleocr import PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    result = ocr.ocr(image_bytes, cls=True)
    if not result or not result[0]:
        return ""
    return "\n".join(line[1][0] for line in result[0] if line and line[1])


def extract_label_fields(image_bytes: bytes) -> dict:
    text = extract_text_from_image(image_bytes)
    return {
        "brand_name": _extract_brand(text),
        "class_type": _extract_class_type(text),
        "alcohol_content": _extract_abv(text),
        "net_contents": _extract_net_contents(text),
        "bottler_producer": _extract_bottler(text),
        "country_of_origin": _extract_country(text),
        "govt_warning": _extract_warning(text),
        "raw_text": text,
    }


def _extract_brand(text: str) -> Optional[str]:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for line in lines[:5]:
        if len(line) > 2 and "GOVERNMENT" not in line.upper():
            return line
    return lines[0] if lines else None


def _extract_class_type(text: str) -> Optional[str]:
    patterns = [
        r"(CABERNET SAUVIGNON|CHARDONNAY|MERLOT|PINOT NOIR|SAUVIGNON BLANC|RIESLING)",
        r"(BOURBON WHISKEY|SCOTCH WHISKY|RYE WHISKEY|TENNESSEE WHISKEY)",
        r"(VODKA|GIN|RUM|TEQUILA|MEZCAL|BRANDY|COGNAC)",
        r"(IPA|PALE ALE|STOUT|PORTER|LAGER|PILSNER|WHEAT BEER|AMBER ALE)",
        r"(BRUT|EXTRA BRUT|BLANC DE BLANCS|PROSECCO|CAVA|CHAMPAGNE)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text.upper())
        if match:
            return match.group(1).title()
    return None


def _extract_abv(text: str) -> Optional[float]:
    for pattern in [
        r"ALC\.?\s*([\d.]+)\s*%\s*BY\s*VOL",
        r"([\d.]+)\s*%\s*(?:ALC|ALCOHOL|ABV)",
        r"ALCOHOL\s*([\d.]+)\s*%",
    ]:
        match = re.search(pattern, text.upper())
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def _extract_net_contents(text: str) -> Optional[str]:
    match = re.search(r"([\d.]+\s*(?:ML|L|FL\.?\s*OZ\.?|OZ))", text, re.IGNORECASE)
    return match.group(1).strip() if match else None


def _extract_bottler(text: str) -> Optional[str]:
    for pattern in [
        r"(?:BOTTLED|PRODUCED|DISTILLED|BREWED)\s+BY\s+(.+?)(?:\n|$)",
        r"(?:BOTTLER|PRODUCER)[:\s]+(.+?)(?:\n|$)",
    ]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_country(text: str) -> Optional[str]:
    countries = [
        "UNITED STATES", "USA", "FRANCE", "ITALY", "SPAIN", "GERMANY",
        "AUSTRALIA", "CHILE", "ARGENTINA", "NEW ZEALAND", "PORTUGAL",
        "MEXICO", "SCOTLAND", "IRELAND", "JAPAN", "CANADA",
    ]
    upper = text.upper()
    for country in countries:
        if country in upper:
            return country.title()
    match = re.search(r"(?:PRODUCT OF|IMPORTED FROM)[:\s]+(.+?)(?:\n|$)", upper)
    return match.group(1).strip().title() if match else None


def _extract_warning(text: str) -> Optional[str]:
    upper = text.upper()
    if "GOVERNMENT WARNING" in upper:
        idx = upper.find("GOVERNMENT WARNING")
        return text[idx:idx + 500].strip()
    return None
