@echo off
echo ============================================================
echo   SmartFix Full-Stack Local Development Launcher
echo ============================================================
echo.

echo Starting SmartFix Express Backend on port 5000...
start "SmartFix Backend (Port 5000)" cmd /k "cd /d %~dp0smartfix\backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting SmartFix React/Vite Frontend on port 5173...
start "SmartFix Frontend (Port 5173)" cmd /k "cd /d %~dp0smartfix\frontend && npm run dev"

echo.
echo ============================================================
echo   Both servers launched!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo ============================================================
