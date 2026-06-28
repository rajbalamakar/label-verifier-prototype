@echo off
cd /d C:\Users\rajba\TTBPrototype
call ttb_venv\Scripts\activate
cd backend
python -m uvicorn app.main:app --reload --port 8000
