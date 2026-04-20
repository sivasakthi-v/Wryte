@echo off
REM One-click backend start. Double-click this file or run from cmd.
REM Activates the local venv, installs deps if missing, then boots uvicorn on :8000.

cd /d "%~dp0backend"

if not exist ".venv\Scripts\uvicorn.exe" (
    echo [start-backend] uvicorn not found in .venv, installing dependencies...
    if not exist ".venv" (
        python -m venv .venv
    )
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -e ".[dev]"
) else (
    call .venv\Scripts\activate.bat
)

echo.
echo [start-backend] Backend starting on http://localhost:8000
echo [start-backend] Press Ctrl+C to stop.
echo.
python -m uvicorn app.main:app --reload --port 8000
