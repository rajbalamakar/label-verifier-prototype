# TTB Label Verifier

AI-powered alcohol label compliance prototype for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

Reviewers upload a Label application PDF and the corresponding label image. The system extracts fields from both, compares them field-by-field using OCR (Optical Character Recognition) and semantic similarity, and returns a pass/review/fail report with mismatch detection.

---

## Prerequisites

- Docker and Docker Compose

---

## Setup and Run

```bash
docker compose up --build
```

- App: http://localhost:80
- API docs: http://localhost:8000/docs

The first build downloads the AI model weights (~90MB) and installs all dependencies — this takes a few minutes. Subsequent starts are fast.

All data (database and uploaded files) is stored on a Docker volume and persists across restarts.

> **Dev mode is on by default.** You are signed in automatically as `agent@ttb.gov` with no login required.

---

## GCP VM Deployment

The app runs on a GCE VM with Docker Compose. SQLite on a persistent disk handles storage.

### One-time VM setup

```bash
# SSH into your VM, then:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker

# Clone the repo
git clone https://github.com/rajbalamakar/label-verifier-prototype.git
cd label-verifier-prototype
```

### Build and run

```bash
docker-compose up --build -d
```

### Update after code changes

```bash
git pull
docker-compose up --build -d
```

### Firewall

Open port 80 (HTTP) on your GCP VM firewall rule to allow public access.

---

## Usage

The app has three entry points from the home page:

### Single Upload
Upload one application PDF and one label image → instant field-by-field compliance report → Approve or Reject.

### Bulk Upload
Drop multiple PDFs and label images together. The system automatically matches PDF↔image pairs by COLA ID and filename prefix, then processes them in parallel with live streaming results. Click any completed row to drill into the full report.

### Recent Verifications
Browse all previously submitted labels. Click a row to reload the full report and update your decision.

---

## Project Structure

```
TTBPrototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Async SQLAlchemy + SQLite
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── auth.py              # Google OAuth + JWT (dev_mode bypass)
│   │   ├── routers/
│   │   │   ├── auth.py          # /auth/login, /callback, /me
│   │   │   ├── verifications.py # /verifications — single, bulk SSE, parse-ids
│   │   │   └── decisions.py     # /decisions — approve/reject
│   │   └── services/
│   │       ├── ocr.py           # Tesseract OCR (Optical Character Recognition) + preprocessing
│   │       ├── pdf_parser.py    # pdfplumber COLA PDF field extraction
│   │       ├── field_matcher.py # Field comparison + semantic similarity
│   │       ├── mismatch.py      # Wrong-label detector
│   │       └── storage.py       # Local file storage
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root — routes between home/single/bulk/recent
│   │   ├── api.js               # Axios + Fetch API calls
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx  # Home — three entry-point cards
│   │   │   ├── SinglePage.jsx   # Single upload + results
│   │   │   ├── BulkPage.jsx     # Bulk upload + live streaming + history
│   │   │   └── RecentPage.jsx   # Browse past verifications
│   │   └── components/
│   │       ├── NavBar.jsx
│   │       ├── ResultsPanel.jsx # 3-column: image | app data | results
│   │       └── FieldResultCard.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── TECHNICAL.md
```

---

## Verification Fields

| Field | Method |
|---|---|
| Brand Name | Sentence-transformer cosine similarity (≥ 0.85) |
| Class / Type | Normalized string match |
| Alcohol Content | Float parse + ±0.3% tolerance (wine), ±0.15% (spirits) |
| Net Contents | Unit-normalized comparison (750mL = 750 ml) |
| Bottler / Producer | Semantic fuzzy match |
| Country of Origin | Keyword match |
| Government Warning | Exact text match after normalization |
