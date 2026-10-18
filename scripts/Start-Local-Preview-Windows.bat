@echo off
cd /d "%~dp0.."
where py >nul 2>nul
if errorlevel 1 (
  echo Python is required to run a local preview, or upload the Cloudflare ZIP to Pages.
  echo Download Python from https://python.org/
  pause
  exit /b 1
)
start "" "http://localhost:8080"
py -m http.server 8080