@echo off
REM One-click frontend start. Double-click this file or run from cmd.
REM Uses npm (pnpm is not required). Installs deps if missing, then boots Next on :3000.

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [start-frontend] node_modules missing, running npm install...
    call npm install
)

echo.
echo [start-frontend] Frontend starting on http://localhost:3000 (will bump to 3001 if busy)
echo [start-frontend] Press Ctrl+C to stop.
echo.
call npm run dev
