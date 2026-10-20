# record_session.ps1 - ghi luong RTSP thanh clip theo quy uoc plan 7.1: clips/YYYYMMDD_<phien>_<so>.mp4
# Chay trong thu muc ai-pipeline:
#   powershell -ExecutionPolicy Bypass -File tools/record_session.ps1             # 90 phut
#   powershell -ExecutionPolicy Bypass -File tools/record_session.ps1 -Minutes 5  # clip thu
# Dia chi RTSP lay tu bien CAM_URL, neu khong co thi tu CAMERA_RTSP_URL trong .env (khong ghi vao repo).
# Task Scheduler: chay luc 05:25 va 17:25, "Start in" = thu muc ai-pipeline (plan 16.6).
param([int]$Minutes = 90)

$url = $env:CAM_URL
if (-not $url -and (Test-Path .env)) {
  $line = Get-Content .env | Where-Object { $_ -match '^CAMERA_RTSP_URL=' } | Select-Object -First 1
  if ($line) { $url = $line.Substring('CAMERA_RTSP_URL='.Length).Trim() }
}
if (-not $url) { throw 'Missing RTSP URL: set CAMERA_RTSP_URL in ai-pipeline/.env or the CAM_URL variable' }

New-Item -ItemType Directory -Force clips | Out-Null
$end = (Get-Date).AddMinutes($Minutes)
$session = if ((Get-Date).Hour -lt 12) { 'morning' } else { 'evening' }
$i = 1
$recorded = @()
while ((Get-Date) -lt $end) {
  $out = "clips/{0:yyyyMMdd}_{1}_{2:d2}.mp4" -f (Get-Date), $session, $i
  $i++
  if (Test-Path $out) { continue }                 # chay lai trong cung phien: ghi tiep sang so moi
  $recorded += $out
  $left = [int]($end - (Get-Date)).TotalSeconds
  # Chi lay hinh: luong hien khong co tieng; neu bat micro camera (G.711) thi mp4 khong chua duoc, ffmpeg se dung ngay.
  # Trong luc ghi dung mp4 phan manh: mat dien/tat may giua chung van doc duoc phan da ghi.
  # -timeout (micro giay): luong dung hinh thi thoat de ghi tiep sang file moi, khong treo.
  ffmpeg -hide_banner -loglevel warning -rtsp_transport tcp -timeout 10000000 -i $url `
    -map 0:v:0 -c copy -an -movflags +frag_keyframe+empty_moov -t $left $out
  if ((Get-Date) -lt $end) { Start-Sleep -Seconds 10 }   # rot mang: cho roi noi lai
}

# mp4 phan manh khong tua duoc tren nhieu trinh phat: het phien thi ghep lai thanh mp4 thuong
# (chi chep, khong nen lai). Ghep loi thi giu nguyen file goc.
foreach ($f in $recorded | Where-Object { Test-Path $_ }) {
  $tmp = "$f.tmp.mp4"
  ffmpeg -hide_banner -loglevel error -y -i $f -map 0 -c copy -movflags +faststart $tmp
  if ((Test-Path $tmp) -and (Get-Item $tmp).Length -gt 0) { Move-Item -Force $tmp $f }
  else { Remove-Item $tmp -ErrorAction SilentlyContinue; Write-Warning "Remux failed, kept fragmented file: $f" }
}
Get-ChildItem "clips/$('{0:yyyyMMdd}' -f (Get-Date))_${session}_*.mp4" | Select-Object Name, Length
