# TTB LabelCheck

AI-powered alcohol label verification prototype for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

## Quick Start (Local Dev)

### Prerequisites
- Python 3.11+
- Node 20+
- Docker + Docker Compose (for Postgres)

### 1. Backend (SQLite by default — no database setup needed)
```bash
cd backend
cp .env.example .env          # edit if needed
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

First run downloads PaddleOCR and sentence-transformer model weights (~600MB). Subsequent starts are fast.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

> **Dev mode is on by default** — Google OAuth is bypassed. You are logged in as `agent@ttb.gov`. Set `DEV_MODE=false` in `.env` and add Google OAuth credentials to enable real auth.

---

## Full Stack with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

---

## Usage

1. **Upload COLA PDF** — drag the application PDF from COLA onto the left panel
2. **Enter COLA Application ID** — e.g. `TTB-2024-087432`
3. **Upload label image** — JPG or PNG of the physical label
4. **Click Verify** — results appear in under 5 seconds
5. **Approve / Reject / Hold** — decision is recorded with your agent email

---

## Deploy to Google Cloud Run

### Prerequisites
- `gcloud` CLI authenticated
- Cloud SQL Postgres instance created
- GCS bucket created

```bash
# Build and push backend
gcloud builds submit ./backend --tag gcr.io/YOUR_PROJECT/ttb-backend

# Deploy backend
gcloud run deploy ttb-labelcheck-backend \
  --image gcr.io/YOUR_PROJECT/ttb-backend \
  --region us-central1 \
  --memory 2Gi \
  --min-instances 1 \
  --set-env-vars DEV_MODE=false \
  --set-secrets DATABASE_URL=db-url:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,SECRET_KEY=secret-key:latest \
  --set-cloudsql-instances YOUR_PROJECT:us-central1:labelcheck \
  --allow-unauthenticated

# Build and deploy frontend
cd frontend && npm run build
# Upload dist/ to GCS and serve via Cloud CDN, or deploy as a second Cloud Run service
```

Store all secrets in **Google Secret Manager** — never in environment variables in production.

---

## Project Structure

```
TTBPrototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── auth.py              # Google OAuth + JWT
│   │   ├── routers/
│   │   │   ├── auth.py          # /auth/login, /callback, /me
│   │   │   ├── applications.py  # /applications (COLA PDF upload)
│   │   │   ├── verifications.py # /verifications (label OCR + compare)
│   │   │   └── decisions.py     # /decisions (approve/reject/hold)
│   │   └── services/
│   │       ├── ocr.py           # PaddleOCR + field extraction
│   │       ├── pdf_parser.py    # pdfplumber COLA PDF parsing
│   │       ├── field_matcher.py # Comparison logic + tolerances
│   │       └── storage.py       # Local filesystem or GCS
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js               # Axios API calls
│   │   └── components/
│   │       ├── NavBar.jsx
│   │       ├── UploadPanel.jsx  # Upload + queue sidebar
│   │       ├── ResultsPanel.jsx # Image + app data + results
│   │       └── FieldResultCard.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Verification Fields

| Field | Method |
|---|---|
| Brand Name | sentence-transformers cosine similarity |
| Class / Type | Normalized string match |
| Alcohol Content | Float parse + ±0.3% tolerance (wine), ±0.15% (spirits) |
| Net Contents | Unit-normalized (750mL = 750 ml) |
| Bottler / Producer | Fuzzy semantic match |
| Country of Origin | Keyword match |
| Govt. Warning | Exact text match (normalized) |

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy (async), Alembic
- **Database**: PostgreSQL 15 (Cloud SQL in production)
- **OCR**: PaddleOCR (local, no external API calls)
- **Matching**: sentence-transformers `all-MiniLM-L6-v2` (local)
- **PDF parsing**: pdfplumber
- **Auth**: Google OAuth via Authlib (restricted to @ttb.gov)
- **Frontend**: React 18, Vite, react-dropzone
- **Deployment**: Google Cloud Run + Docker
