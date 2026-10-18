#!/usr/bin/env sh
set -eu
if [ "$#" -lt 1 ]; then echo "Usage: sh convert-to-social-mp4.sh input.mp4"; exit 1; fi
command -v ffmpeg >/dev/null || { echo "FFmpeg is required: https://ffmpeg.org/download.html";exit 1; }
input="$1"
base="${input%.*}"
ffmpeg -hide_banner -y -i "$input" -map 0:v:0 -map 0:a? -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${base}-social-ready.mp4"
echo "Ready: ${base}-social-ready.mp4"