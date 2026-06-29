"""Quick end-to-end test against the running backend."""
import requests

BASE = "http://localhost:8000"
EXAMPLES = "C:/Users/rajba/TTBPrototype/examples"

def test(cola_id, label, expected):
    print(f"\n{'='*60}")
    print(f"Testing {cola_id} — expected: {expected}")
    print('='*60)

    # Upload COLA PDF
    pdf_path = f"{EXAMPLES}/{cola_id}_cola_application.pdf"
    with open(pdf_path, "rb") as f:
        r = requests.post(f"{BASE}/applications/upload-pdf",
                          data={"cola_id": cola_id},
                          files={"file": ("app.pdf", f, "application/pdf")})
    if r.status_code not in (200, 201):
        print(f"  COLA upload FAILED: {r.status_code} {r.text[:200]}")
        return
    d = r.json()
    print(f"  COLA parsed  : brand='{d.get('brand_name')}' abv={d.get('alcohol_content')} type='{d.get('class_type')}'")

    # Verify label image
    img_path = f"{EXAMPLES}/{cola_id}_label.jpg"
    with open(img_path, "rb") as f:
        r2 = requests.post(f"{BASE}/verifications/",
                           data={"cola_id": cola_id},
                           files={"file": ("label.jpg", f, "image/jpeg")})
    if r2.status_code not in (200, 201):
        print(f"  Verify FAILED: {r2.status_code} {r2.text[:200]}")
        return
    v = r2.json()
    print(f"  Overall      : {v.get('overall_status').upper()} ({v.get('processing_time_ms')}ms)")
    for field in v.get("results", []):
        icon = {"pass": "✓", "review": "⚠", "fail": "✗"}.get(field["status"], "?")
        print(f"  {icon} {field['field']:<20} extracted='{field['extracted']}' | {field.get('detail','')}")


if __name__ == "__main__":
    test("TTB-2024-001", "TTB-2024-001_label.jpg", "ALL PASS")
    test("TTB-2024-002", "TTB-2024-002_label.jpg", "REVIEW")
    test("TTB-2024-003", "TTB-2024-003_label.jpg", "FAIL")
    test("TTB-2024-004", "TTB-2024-004_label.jpg", "REVIEW")
    test("TTB-2024-005", "TTB-2024-005_label.jpg", "MISMATCH")
    print("\nDone.")
