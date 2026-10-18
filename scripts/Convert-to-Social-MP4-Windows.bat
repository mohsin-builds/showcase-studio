@echo off
setlocal enabledelayedexpansion
if "%~1"=="" (
 echo Drag and drop a Showcase Studio video onto this .bat file.
 echo The FFmpeg command line tool is required: https://ffmpeg.org/download.html
 pause
 exit /b 1
)
where ffmpeg >nul 2>nul
if errorlevel 1 (
 echo FFmpeg is not installed or not on PATH.
 echo Install FFmpeg from https://ffmpeg.org/download.html and retry.
 pause
 exit /b 1
)
set "INPUT=%~1"
set "OUTPUT=%~dpn1-social-ready.mp4"
echo Converting to H.264 video and AAC audio for social media...
ffmpeg -hide_banner -y -i "%INPUT%" -map 0:v:0 -map 0:a? -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "%OUTPUT%"
if errorlevel 1 (
 echo Conversion failed. Check the source video and FFmpeg installation.
 pause
 exit /b 1
)
echo.
echo Ready: %OUTPUT%
pause