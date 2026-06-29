import re
from typing import Optional
from app.schemas import FieldResult
from app.services.pdf_parser import normalize_warning, get_canonical_warning

# Lazy-load sentence-transformers to avoid slow startup
_model = None

# ABV tolerances per beverage category (TTB guidelines)
ABV_TOLERANCES = {
    "wine": 0.3,
    "beer": 0.3,
    "spirits": 0.15,
    "default": 0.3,
}


def get_similarity_model():
    global _model
    if _model is None:
        import os
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_DATASETS_OFFLINE"] = "1"
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    return _model


def semantic_similarity(text_a: str, text_b: str) -> float:
    """Return cosine similarity between two strings using sentence-transformers."""
    if not text_a or not text_b:
        return 0.0
    model = get_similarity_model()
    import numpy as np
    embeddings = model.encode([text_a.lower(), text_b.lower()])
    cos_sim = float(
        np.dot(embeddings[0], embeddings[1])
        / (np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1]))
    )
    return max(0.0, cos_sim)


def normalize_volume(text: str) -> Optional[float]:
    """Normalize volume to milliliters."""
    if not text:
        return None
    text = text.upper().replace(" ", "")
    match = re.search(r"([\d.]+)\s*(ML|L|FLOZ|OZ)", text)
    if not match:
        return None
    value, unit = float(match.group(1)), match.group(2)
    conversions = {"ML": 1, "L": 1000, "FLOZ": 29.5735, "OZ": 29.5735}
    return value * conversions.get(unit, 1)


def verify_brand_name(expected: str, extracted: str) -> FieldResult:
    if not extracted:
        return FieldResult(field="brand_name", expected=expected, extracted=None,
                           status="fail", confidence=0.0, detail="Not found on label")

    sim = semantic_similarity(expected, extracted)
    if sim >= 0.92:
        return FieldResult(field="brand_name", expected=expected, extracted=extracted,
                           status="pass", confidence=sim, detail="Case-normalized match")
    if sim >= 0.75:
        return FieldResult(field="brand_name", expected=expected, extracted=extracted,
                           status="review", confidence=sim, detail=f"Similarity {sim:.0%} — agent review recommended")
    return FieldResult(field="brand_name", expected=expected, extracted=extracted,
                       status="fail", confidence=sim, detail=f"Similarity {sim:.0%} — mismatch")


def verify_class_type(expected: str, extracted: str) -> FieldResult:
    if not extracted:
        return FieldResult(field="class_type", expected=expected, extracted=None,
                           status="fail", confidence=0.0, detail="Not found on label")
    match = expected.strip().upper() == extracted.strip().upper()
    sim = semantic_similarity(expected, extracted)
    status = "pass" if match or sim >= 0.9 else ("review" if sim >= 0.75 else "fail")
    return FieldResult(field="class_type", expected=expected, extracted=extracted,
                       status=status, confidence=sim)


def verify_alcohol_content(expected: float, extracted: float,
                           beverage_type: str = "default") -> FieldResult:
    if extracted is None:
        return FieldResult(field="alcohol_content", expected=expected, extracted=None,
                           status="fail", confidence=0.0, detail="ABV not found on label")

    tolerance = ABV_TOLERANCES.get(beverage_type.lower(), ABV_TOLERANCES["default"])
    delta = abs(expected - extracted)

    if delta == 0:
        return FieldResult(field="alcohol_content", expected=expected, extracted=extracted,
                           status="pass", confidence=1.0)
    if delta <= tolerance:
        return FieldResult(field="alcohol_content", expected=expected, extracted=extracted,
                           status="review", confidence=0.85,
                           detail=f"Δ {delta:.1f}% — within ±{tolerance}% tolerance")
    return FieldResult(field="alcohol_content", expected=expected, extracted=extracted,
                       status="fail", confidence=0.0,
                       detail=f"Δ {delta:.1f}% — exceeds ±{tolerance}% tolerance")


def verify_net_contents(expected: str, extracted: str) -> FieldResult:
    exp_ml = normalize_volume(expected)
    ext_ml = normalize_volume(extracted)

    if ext_ml is None:
        return FieldResult(field="net_contents", expected=expected, extracted=extracted,
                           status="fail", confidence=0.0, detail="Volume not found or unparseable")

    if exp_ml and abs(exp_ml - ext_ml) < 1:
        return FieldResult(field="net_contents", expected=expected, extracted=extracted,
                           status="pass", confidence=1.0, detail="Unit-normalized match")

    return FieldResult(field="net_contents", expected=expected, extracted=extracted,
                       status="fail", confidence=0.0, detail=f"Expected {exp_ml}mL, found {ext_ml}mL")


def verify_bottler(expected: str, extracted: str) -> FieldResult:
    if not extracted:
        return FieldResult(field="bottler_producer", expected=expected, extracted=None,
                           status="fail", confidence=0.0, detail="Bottler/producer not found")
    sim = semantic_similarity(expected, extracted)
    status = "pass" if sim >= 0.85 else ("review" if sim >= 0.70 else "fail")
    return FieldResult(field="bottler_producer", expected=expected, extracted=extracted,
                       status=status, confidence=sim)


COUNTRY_ALIASES = {
    "USA": "UNITED STATES",
    "US": "UNITED STATES",
    "U.S.": "UNITED STATES",
    "U.S.A.": "UNITED STATES",
    "AMERICA": "UNITED STATES",
    "UK": "UNITED KINGDOM",
    "GREAT BRITAIN": "UNITED KINGDOM",
    "SCOTLAND": "UNITED KINGDOM",
}


def _normalize_country(name: str) -> str:
    upper = name.strip().upper()
    return COUNTRY_ALIASES.get(upper, upper)


def verify_country(expected: str, extracted: str) -> FieldResult:
    if not extracted:
        return FieldResult(field="country_of_origin", expected=expected, extracted=None,
                           status="fail", confidence=0.0, detail="Country not found")
    match = _normalize_country(expected) == _normalize_country(extracted)
    return FieldResult(field="country_of_origin", expected=expected, extracted=extracted,
                       status="pass" if match else "fail", confidence=1.0 if match else 0.0,
                       detail="Alias match (USA = United States)" if match and extracted.upper() != expected.upper() else None)


WARNING_KEY_PHRASES = [
    "SURGEON GENERAL",
    "BIRTH DEFECTS",
    "DRIVE A CAR",
    "OPERATE MACHINERY",
    "HEALTH PROBLEMS",
]


def _warning_word_overlap(extracted: str, canonical: str) -> float:
    """Fraction of canonical words found in extracted text."""
    canon_words = set(canonical.split())
    found = sum(1 for w in canon_words if w in extracted)
    return found / len(canon_words) if canon_words else 0.0


def verify_govt_warning(extracted_warning: Optional[str]) -> FieldResult:
    if not extracted_warning:
        return FieldResult(field="govt_warning", expected="Required (standard text)",
                           extracted=None, status="fail", confidence=0.0,
                           detail="Government warning not detected on label")

    normalized = normalize_warning(extracted_warning)
    canonical = get_canonical_warning()

    # Exact or near-exact match
    if canonical in normalized or normalized in canonical:
        return FieldResult(field="govt_warning", expected="Required (standard text)",
                           extracted="Present", status="pass", confidence=1.0,
                           detail="All-caps · full text verified")

    # Fuzzy match: check word overlap and key phrases
    overlap = _warning_word_overlap(normalized, canonical)
    phrases_found = sum(1 for p in WARNING_KEY_PHRASES if p in normalized)

    if overlap >= 0.75 or phrases_found >= 4:
        return FieldResult(field="govt_warning", expected="Required (standard text)",
                           extracted="Present", status="pass", confidence=round(overlap, 2),
                           detail=f"Text verified ({phrases_found}/{len(WARNING_KEY_PHRASES)} key phrases, {overlap:.0%} word match)")

    if overlap >= 0.5 or phrases_found >= 2:
        return FieldResult(field="govt_warning", expected="Required (standard text)",
                           extracted="Partial", status="review", confidence=round(overlap, 2),
                           detail=f"Warning present but may be incomplete ({phrases_found}/{len(WARNING_KEY_PHRASES)} key phrases)")

    return FieldResult(field="govt_warning", expected="Required (standard text)",
                       extracted=extracted_warning[:100], status="fail", confidence=0.0,
                       detail="Warning text does not match required format")


BEVERAGE_CATEGORIES = {
    "wine":    {"CABERNET", "SAUVIGNON", "CHARDONNAY", "MERLOT", "PINOT", "RIESLING",
                "BLANC", "ROUGE", "BRUT", "PROSECCO", "CHAMPAGNE", "CAVA", "ROSÉ", "ROSE"},
    "beer":    {"IPA", "ALE", "STOUT", "PORTER", "LAGER", "PILSNER", "WHEAT", "AMBER", "HAZY"},
    "spirits": {"WHISKEY", "WHISKY", "BOURBON", "SCOTCH", "VODKA", "GIN", "RUM",
                "TEQUILA", "MEZCAL", "BRANDY", "COGNAC", "TENNESSEE"},
}


def _beverage_category(class_type: str) -> Optional[str]:
    upper = class_type.upper()
    for cat, keywords in BEVERAGE_CATEGORIES.items():
        if any(kw in upper for kw in keywords):
            return cat
    return None


def _detect_mismatch(results: list[FieldResult], application: dict, label_fields: dict) -> Optional[str]:
    """
    Return a mismatch reason string if the image looks like the wrong label entirely,
    or None if the results look like a normal compliance check.
    """
    # Exclude govt_warning from confidence scoring — it's presence-based, not similarity-based
    scored = [r for r in results if r.field != "govt_warning" and r.extracted is not None]
    if not scored:
        return None

    avg_confidence = sum(r.confidence for r in scored) / len(scored)
    fail_count = sum(1 for r in scored if r.status == "fail")
    fail_ratio = fail_count / len(scored)

    # All or nearly all fields fail with near-zero confidence → wrong label entirely
    if avg_confidence < 0.15 and fail_ratio >= 0.75:
        return "Almost all fields unrecognizable — this image may be the wrong label for this application."

    # Brand name near-zero similarity (not just a variation — completely different product)
    brand_result = next((r for r in results if r.field == "brand_name"), None)
    if brand_result and brand_result.confidence < 0.10 and brand_result.extracted:
        return (
            f"Brand name on label ('{brand_result.extracted}') bears no resemblance to "
            f"application brand ('{application.get('brand_name')}') — possible wrong label."
        )

    # Beverage category completely different (wine vs beer vs spirits)
    expected_cat = _beverage_category(application.get("class_type", ""))
    extracted_class = label_fields.get("class_type", "")
    if expected_cat and extracted_class:
        extracted_cat = _beverage_category(extracted_class)
        if extracted_cat and extracted_cat != expected_cat:
            return (
                f"Beverage category mismatch: application is {expected_cat} "
                f"but label appears to be {extracted_cat}. Wrong image submitted?"
            )

    return None


def run_verification(application: dict, label_fields: dict) -> tuple[list[FieldResult], str]:
    """Compare extracted label fields against COLA application data."""
    results = []

    if application.get("brand_name"):
        results.append(verify_brand_name(application["brand_name"], label_fields.get("brand_name")))

    if application.get("class_type"):
        results.append(verify_class_type(application["class_type"], label_fields.get("class_type")))

    if application.get("alcohol_content") is not None:
        results.append(verify_alcohol_content(
            application["alcohol_content"],
            label_fields.get("alcohol_content"),
        ))

    if application.get("net_contents"):
        results.append(verify_net_contents(application["net_contents"], label_fields.get("net_contents")))

    if application.get("bottler_producer"):
        results.append(verify_bottler(application["bottler_producer"], label_fields.get("bottler_producer")))

    if application.get("country_of_origin"):
        results.append(verify_country(application["country_of_origin"], label_fields.get("country_of_origin")))

    results.append(verify_govt_warning(label_fields.get("govt_warning")))

    # Mismatch detection — runs before overall status
    mismatch_reason = _detect_mismatch(results, application, label_fields)
    if mismatch_reason:
        return results, f"mismatch:{mismatch_reason}"

    # Overall status: any fail → fail, any review → review, else pass
    statuses = {r.status for r in results}
    if "fail" in statuses:
        overall = "fail"
    elif "review" in statuses:
        overall = "review"
    else:
        overall = "pass"

    return results, overall
