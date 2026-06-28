"""
Generates 3 synthetic test examples, each with:
  - A COLA application PDF (simulates what agents download from the COLA system)
  - A label image (JPG, simulates the physical bottle label photo)

Example 1: TTB-2024-001 -- Ridgeline Cabernet Sauvignon (ALL PASS)
Example 2: TTB-2024-002 -- Stone's Throw Bourbon (WARN: brand case variation + ABV within tolerance)
Example 3: TTB-2024-003 -- Cascade IPA Reserve (FAIL: ABV mismatch exceeds tolerance + warning missing)
"""

from pathlib import Path
from fpdf import FPDF, XPos, YPos
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent

GOVT_WARNING = (
    "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, "
    "WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY "
    "BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF "
    "ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR "
    "OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS."
)

EXAMPLES = [
    {
        "cola_id": "TTB-2024-001",
        "expected_result": "ALL PASS",
        "app": {
            "Brand Name":        "Ridgeline Estate Wines",
            "Class/Type":        "Cabernet Sauvignon",
            "Alcohol Content":   "14.0% by volume",
            "Net Contents":      "750 mL",
            "Bottler/Producer":  "Ridgeline Estate Winery",
            "Address":           "1250 Silverado Trail, Napa Valley, CA 94558",
            "Country of Origin": "United States",
            "Govt Warning":      "Required (standard text)",
        },
        "label": {
            "brand":    "RIDGELINE ESTATE WINES",
            "type":     "CABERNET SAUVIGNON",
            "abv":      "ALC. 14.0% BY VOL.",
            "vol":      "750 mL",
            "producer": "BOTTLED BY RIDGELINE ESTATE WINERY",
            "address":  "1250 Silverado Trail, Napa Valley, CA 94558",
            "origin":   "PRODUCT OF USA",
            "warning":  GOVT_WARNING,
            "bg":       (240, 235, 215),
            "accent":   (80, 30, 20),
        },
    },
    {
        "cola_id": "TTB-2024-002",
        "expected_result": "WARN: brand case variation + ABV within +/-0.3pct tolerance",
        "app": {
            "Brand Name":        "Stone's Throw Distillery",
            "Class/Type":        "Bourbon Whiskey",
            "Alcohol Content":   "45.0% by volume",
            "Net Contents":      "750 mL",
            "Bottler/Producer":  "Stone's Throw Distillery LLC",
            "Address":           "800 Barrel House Rd, Bardstown, KY 40004",
            "Country of Origin": "United States",
            "Govt Warning":      "Required (standard text)",
        },
        "label": {
            "brand":    "STONE'S THROW",        # missing "Distillery" -- semantic warn
            "type":     "KENTUCKY STRAIGHT BOURBON WHISKEY",
            "abv":      "ALC. 44.8% BY VOL.",  # within +/-0.3 of 45.0
            "vol":      "750 ML",
            "producer": "DISTILLED BY STONE'S THROW DISTILLERY LLC",
            "address":  "800 Barrel House Rd, Bardstown, KY 40004",
            "origin":   "PRODUCT OF UNITED STATES",
            "warning":  GOVT_WARNING,
            "bg":       (210, 185, 140),
            "accent":   (60, 30, 10),
        },
    },
    {
        "cola_id": "TTB-2024-003",
        "expected_result": "FAIL: ABV 6.2pct vs 5.0pct (exceeds tolerance), govt warning absent",
        "app": {
            "Brand Name":        "Cascade IPA Reserve",
            "Class/Type":        "India Pale Ale",
            "Alcohol Content":   "5.0% by volume",
            "Net Contents":      "355 mL",
            "Bottler/Producer":  "Pacific Crest Brewing Co.",
            "Address":           "420 Hop Yard Ave, Portland, OR 97201",
            "Country of Origin": "United States",
            "Govt Warning":      "Required (standard text)",
        },
        "label": {
            "brand":    "CASCADE IPA RESERVE",
            "type":     "INDIA PALE ALE",
            "abv":      "ALC. 6.2% BY VOL.",   # exceeds +/-0.3 tolerance
            "vol":      "355 mL",
            "producer": "BREWED BY PACIFIC CREST BREWING CO.",
            "address":  "420 Hop Yard Ave, Portland, OR 97201",
            "origin":   "PRODUCT OF USA",
            "warning":  None,                   # deliberately omitted
            "bg":       (195, 220, 200),
            "accent":   (20, 70, 40),
        },
    },
]


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

def make_cola_pdf(ex: dict) -> Path:
    app = ex["app"]
    cola_id = ex["cola_id"]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # Header bar
    pdf.set_fill_color(26, 58, 92)
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(20, 7)
    pdf.cell(0, 7, "ALCOHOL AND TOBACCO TAX AND TRADE BUREAU (TTB)",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_xy(20, 17)
    pdf.cell(0, 6, "Certificate of Label Approval (COLA) -- Application Data",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(20, 35)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, f"Application ID: {cola_id}",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, f"Status: Pending Review    Filed: 2024-03-15    Test scenario: {ex['expected_result']}",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Divider
    pdf.ln(4)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(6)

    # Fields table
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(240, 243, 248)
    pdf.cell(65, 7, "Field", border=1, fill=True)
    pdf.cell(105, 7, "Application Value", border=1, fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 10)
    alt = False
    for label, value in app.items():
        pdf.set_fill_color(248, 249, 251 if alt else 255)
        pdf.cell(65, 7, label, border=1, fill=True)
        pdf.cell(105, 7, value, border=1, fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        alt = not alt

    # Government warning block
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 6, "Required Government Warning Statement (must appear verbatim on label):",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_fill_color(255, 250, 230)
    pdf.multi_cell(170, 5, GOVT_WARNING, border=1, fill=True)

    # Footer
    pdf.set_y(-22)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5,
             f"TTB COLA {cola_id} -- FOR PROTOTYPE TESTING ONLY -- NOT A REAL GOVERNMENT DOCUMENT",
             align="C")

    path = OUT / f"{cola_id}_cola_application.pdf"
    pdf.output(str(path))
    return path


# ---------------------------------------------------------------------------
# Label image generation
# ---------------------------------------------------------------------------

def try_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        f"C:/Windows/Fonts/Arial{'Bd' if bold else ''}.ttf",
        f"C:/Windows/Fonts/arial{'b' if bold else ''}.ttf",
        "C:/Windows/Fonts/DejaVuSans-Bold.ttf" if bold else "C:/Windows/Fonts/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def make_label_image(ex: dict) -> Path:
    lbl = ex["label"]
    cola_id = ex["cola_id"]
    # Real front labels are roughly 3.5" x 4" — use 600x680 (landscape-ish portrait)
    W, H = 600, 680
    bg = lbl["bg"]
    accent = lbl["accent"]

    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # Outer border
    draw.rectangle([(8, 8), (W - 8, H - 8)], outline=accent, width=3)
    draw.rectangle([(15, 15), (W - 15, H - 15)], outline=accent, width=1)

    def centered(y: int, text: str, font, color=(20, 20, 20)) -> int:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(((W - tw) // 2, y), text, font=font, fill=color)
        return th

    def rule(y: int, pad: int = 40):
        draw.line([(pad, y), (W - pad, y)], fill=accent, width=2)

    y = 36

    # Brand
    font_brand = try_font(36, bold=True)
    for line in lbl["brand"].split("\n"):
        h = centered(y, line, font_brand, color=accent)
        y += h + 6
    y += 4
    rule(y); y += 12

    # Class / type
    font_type = try_font(20)
    h = centered(y, lbl["type"], font_type, color=(70, 70, 70))
    y += h + 10
    rule(y); y += 14

    # Decorative oval
    draw.ellipse([(W // 2 - 36, y), (W // 2 + 36, y + 32)], outline=accent, width=2)
    y += 48

    # ABV + Volume on same line
    font_abv = try_font(20, bold=True)
    font_vol = try_font(18)
    abv_text = lbl["abv"]
    vol_text = lbl["vol"]
    abv_bbox = draw.textbbox((0, 0), abv_text, font=font_abv)
    vol_bbox = draw.textbbox((0, 0), vol_text, font=font_vol)
    total_w = (abv_bbox[2] - abv_bbox[0]) + 30 + (vol_bbox[2] - vol_bbox[0])
    x_start = (W - total_w) // 2
    draw.text((x_start, y), abv_text, font=font_abv, fill=(20, 20, 20))
    draw.text((x_start + (abv_bbox[2] - abv_bbox[0]) + 30, y + 1), vol_text, font=font_vol, fill=(80, 80, 80))
    y += max(abv_bbox[3] - abv_bbox[1], vol_bbox[3] - vol_bbox[1]) + 14
    rule(y); y += 12

    # Producer, address, origin
    font_sm = try_font(13)
    for line in [lbl["producer"], lbl["address"], lbl["origin"]]:
        h = centered(y, line, font_sm, color=(55, 55, 55))
        y += h + 5
    y += 8
    rule(y); y += 10

    # Government warning (or deliberate omission)
    if lbl["warning"]:
        font_warn = try_font(10, bold=True)
        words = lbl["warning"].split()
        lines_out: list[str] = []
        current = ""
        for word in words:
            test = (current + " " + word).strip()
            bbox = draw.textbbox((0, 0), test, font=font_warn)
            if bbox[2] - bbox[0] > W - 60:
                lines_out.append(current)
                current = word
            else:
                current = test
        if current:
            lines_out.append(current)

        block_h = len(lines_out) * 14 + 10
        draw.rectangle([(25, y - 4), (W - 25, min(y + block_h, H - 14))],
                       outline=(0, 0, 0), width=1)
        for line in lines_out:
            if y + 14 > H - 14:
                break
            bbox = draw.textbbox((0, 0), line, font=font_warn)
            tw = bbox[2] - bbox[0]
            draw.text(((W - tw) // 2, y), line, font=font_warn, fill=(0, 0, 0))
            y += 14
    else:
        font_omit = try_font(12)
        centered(y, "[Government warning deliberately omitted -- FAIL test case]",
                 font_omit, color=(180, 30, 30))

    path = OUT / f"{cola_id}_label.jpg"
    img.save(str(path), quality=92)
    return path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating test examples...\n")
    for ex in EXAMPLES:
        pdf_path = make_cola_pdf(ex)
        img_path = make_label_image(ex)
        print(f"  [{ex['cola_id']}]  Expected: {ex['expected_result']}")
        print(f"    PDF:   {pdf_path.name}")
        print(f"    Label: {img_path.name}\n")
    print("Done. All files written to examples/")
