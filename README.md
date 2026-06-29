# TTB Label Verifier

AI-powered alcohol label compliance prototype for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

Reviewers upload a COLA application PDF and the corresponding label image. The system extracts fields from both, compares them field-by-field using OCR and semantic similarity, and returns a pass/warn/fail report with mismatch detection.

---

## Prerequisites

- Python 3.11+
- Node 20+
- Tesseract OCR installed locally (for non-Docker dev)
  - Windows: https://github.com/UB-Mannheim/tesseract/wiki
  - macOS: `brew install tesseract`
  - Linux: `sudo apt install tesseract-ocr tesseract-ocr-eng`
- Docker + Docker Compose (for containerised run)

---

## Local Development

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv ttb_venv
source ttb_venv/bin/activate      # Windows: ttb_venv\Scripts\activate

# Install dependencies (CPU-only PyTorch first to avoid 3GB CUDA download)
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# Copy and edit environment config
cp .env.example .env

# Start the backend
uvicorn app.main:app --reload --port 8000
```

First run downloads the `all-MiniLM-L6-v2` sentence-transformer model (~90MB). Subsequent starts are fast.

Database defaults to SQLite at `./labelcheck.db` — no setup needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

> **Dev mode is on by default.** Google OAuth is bypassed and you are signed in as `agent@ttb.gov`. To enable real auth, set `DEV_MODE=false` in `.env` and add Google OAuth credentials.

---

## Docker (Full Stack)

```bash
docker compose up --build
```

- App (via nginx): http://localhost:80
- Backend API: http://localhost:8000/docs

SQLite database and uploaded files are stored on a named Docker volume (`app_data`) and persist across container restarts.

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
│   │       ├── ocr.py           # Tesseract OCR + preprocessing
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
