@echo off
title AgentShield Hackathon Demo Gateway
cd /d "%~dp0"
echo ============================================================
echo   AgentShield Enterprise Security Gateway - Hackathon Suite
echo ============================================================
echo.
echo Starting AgentShield on http://localhost:3000 ...
echo Opening your browser to the Attack Simulator (Demos 1-6)...
echo.
start "" "http://localhost:3000/simulator"
npm run dev
pause
