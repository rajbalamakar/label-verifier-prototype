import re
import pdfplumber
from typing import Optional
from io import BytesIO


GOVT_WARNING_TEXT = (
    "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK "
    "ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. "
    "(2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR "
    "OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS."
)


def parse_cola_pdf(pdf_bytes: bytes) -> tuple[str | None, dict]:
    """Extract COLA ID and application fields from a PDF.
    Returns (cola_id_or_None, fields_dict).
    """
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    cola_id = _extract_cola_id(text)
    fields = {
        "brand_name": _extract_field(text, [r"Brand Name[:\s]+(.+)", r"BRAND NAME[:\s]+(.+)"]),
        "class_type": _extract_field(text, [r"Class[/\s]*Type[:\s]+(.+)", r"CLASS[/\s]*TYPE[:\s]+(.+)", r"Type of Product[:\s]+(.+)"]),
        "alcohol_content": _extract_abv(text),
        "net_contents": _extract_field(text, [r"Net Contents?[:\s]+(.+)", r"NET CONTENTS?[:\s]+(.+)", r"Volume[:\s]+(.+)"]),
        "bottler_producer": _extract_field(text, [r"Bottled By[:\s]+(.+)", r"BOTTLED BY[:\s]+(.+)", r"Producer[:\s]+(.+)", r"Bottler[:\s]+(.+)"]),
        "address": _extract_field(text, [r"Address[:\s]+(.+)", r"ADDRESS[:\s]+(.+)"]),
        "country_of_origin": _extract_field(text, [r"Country of Origin[:\s]+(.+)", r"COUNTRY OF ORIGIN[:\s]+(.+)", r"Imported From[:\s]+(.+)"]),
        "govt_warning_required": True,
    }
    return cola_id, fields


def _extract_cola_id(text: str) -> str | None:
    match = re.search(r"Application\s+ID[:\s]+([A-Z0-9][A-Z0-9\-]+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else None


def _extract_field(text: str, patterns: list[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_abv(text: str) -> Optional[float]:
    patterns = [
        r"Alcohol(?:\s+Content)?[:\s]+([\d.]+)\s*%",
        r"ALC\.?\s+([\d.]+)\s*%",
        r"([\d.]+)\s*%\s*(?:ALC|ALCOHOL|ABV)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def normalize_warning(text: str) -> str:
    """Normalize whitespace and case for government warning comparison."""
    return " ".join(text.upper().split())


def get_canonical_warning() -> str:
    return normalize_warning(GOVT_WARNING_TEXT)
