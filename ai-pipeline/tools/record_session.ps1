<#
.SYNOPSIS
  Ghi luồng RTSP của camera nhà yến trong một phiên chim bay, cắt thành file 10 phút.

.DESCRIPTION
  Dùng cho dev từ xa (docs/bird-counting-plan.md mục 16.6): laptop kéo RTSP qua IP public
  của modem và ghi nguyên luồng (không nén lại) vào ai-pipeline/clips/.

  - Địa chỉ RTSP lấy từ CAMERA_RTSP_URL: biến môi trường, hoặc dòng trong ai-pipeline/.env
    (có mật khẩu camera; .env không được commit).
  - Tên file theo quy ước mục 7.1: YYYYMMDD_<phiên>_<số>.mp4.
  - Mất kết nối thì chờ 10 giây rồi ghi tiếp sang file mới, cho tới giờ -Until.
  - Chỉ ghi luồng hình (-map 0:v): tiếng của camera có thể là G.711, không ghi được vào MP4.
  - Dừng sớm nếu ổ đĩa còn dưới -MinFreeGB.
  - Cuối phiên ghi tổng thời lượng đã ghi vào file log, để biết đường truyền có rớt không.

  Lịch chạy tự động: install_record_tasks.ps1.

.EXAMPLE
  .\record_session.ps1 -Session evening -Until 19:10
  .\record_session.ps1 -Session evening -Until (Get-Date).AddMinutes(2).ToString('HH:mm')   # thử 2 phút
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('morning', 'evening')][string]$Session,
  [Parameter(Mandatory = $true)][ValidatePattern('^\d{2}:\d{2}$')][string]$Until,
  [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'clips'),
  [ValidateRange(1, 60)][int]$SegmentMinutes = 10,
  [ValidateRange(1, 1000)][int]$MinFreeGB = 5
)

$ErrorActionPreference = 'Stop'

$day = Get-Date -Format 'yyyyMMdd'
$end = [datetime]::ParseExact("$day $Until", 'yyyyMMdd HH:mm', $null)
$logDir = Join-Path $OutDir 'logs'
New-Item -ItemType Directory -Force -Path $OutDir, $logDir | Out-Null
$log = Join-Path $logDir "record_${day}_${Session}.log"

function Write-Log([string]$message) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $message
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-NextIndex {
  $numbers = Get-ChildItem -Path $OutDir -Filter "${day}_${Session}_*.mp4" -ErrorAction SilentlyContinue |
    ForEach-Object { if ($_.BaseName -match '_(\d+)$') { [int]$Matches[1] } }
  if ($numbers) { return ([int]($numbers | Measure-Object -Maximum).Maximum) + 1 }
  return 1
}

function Get-FreeGB {
  $root = [System.IO.Path]::GetPathRoot((Resolve-Path $OutDir).Path)
  return [math]::Round((New-Object System.IO.DriveInfo($root)).AvailableFreeSpace / 1GB, 1)
}

function Get-CameraUrl {
  if ($env:CAMERA_RTSP_URL) { return $env:CAMERA_RTSP_URL }
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
      if ($line -match '^\s*CAMERA_RTSP_URL\s*=\s*(.+?)\s*$') { return $Matches[1].Trim('"', "'") }
    }
  }
  return $null
}

$url = Get-CameraUrl
if (-not $url) {
  Write-Log 'Thiếu CAMERA_RTSP_URL. Thêm dòng CAMERA_RTSP_URL=rtsp://admin:<mật khẩu>@<IP hoặc DDNS>:18554/stream1 vào ai-pipeline/.env'
  exit 1
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Log 'Không tìm thấy ffmpeg. Cài bằng: winget install Gyan.FFmpeg, rồi mở lại cửa sổ PowerShell.'
  exit 1
}
if ((Get-Date) -ge $end) {
  Write-Log "Đã quá giờ dừng $Until, không ghi."
  exit 0
}

$started = Get-Date
Write-Log "Bắt đầu phiên $Session, ghi tới $Until vào $OutDir"

while ((Get-Date) -lt $end) {
  $free = Get-FreeGB
  if ($free -lt $MinFreeGB) {
    Write-Log "Ổ đĩa chỉ còn $free GB (dưới $MinFreeGB GB), dừng ghi. Chép clip cũ ra chỗ khác rồi chạy lại."
    break
  }

  $left = [int][math]::Floor(($end - (Get-Date)).TotalSeconds)
  if ($left -lt 5) { break }
  $index = Get-NextIndex
  $pattern = Join-Path $OutDir "${day}_${Session}_%02d.mp4"
  $errFile = Join-Path $logDir "ffmpeg_${day}_${Session}_$index.txt"

  Write-Log "Mở luồng, file bắt đầu từ số $index, còn $left giây"
  $ffmpegArgs = @(
    '-hide_banner', '-loglevel', 'warning', '-nostdin',
    '-rtsp_transport', 'tcp',
    '-timeout', '10000000',                       # 10 giây không nhận được gì thì thoát, không treo
    '-i', "`"$url`"",
    '-map', '0:v', '-c', 'copy',
    '-t', "$left",
    '-f', 'segment', '-segment_time', "$($SegmentMinutes * 60)",
    '-segment_format', 'mp4', '-reset_timestamps', '1',
    '-segment_start_number', "$index",
    "`"$pattern`""
  )
  $proc = Start-Process -FilePath 'ffmpeg' -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru `
    -RedirectStandardError $errFile
  $detail = (Get-Content $errFile -ErrorAction SilentlyContinue | Select-Object -Last 3) -join ' | '
  if ((Get-Item $errFile).Length -eq 0) { Remove-Item $errFile }

  if ((Get-Date) -lt $end) {
    Write-Log "ffmpeg dừng giữa chừng (mã $($proc.ExitCode)). $detail Thử lại sau 10 giây."
    Start-Sleep -Seconds 10
  }
}

# Tổng kết: thời lượng đã ghi so với thời gian của phiên
$files = Get-ChildItem -Path $OutDir -Filter "${day}_${Session}_*.mp4" -ErrorAction SilentlyContinue
$recorded = 0.0
foreach ($f in $files) {
  $d = & ffprobe -v error -show_entries format=duration -of csv=p=0 $f.FullName 2>$null
  if ($d) { $recorded += [double]::Parse($d.Trim(), [cultureinfo]::InvariantCulture) }
}
$expected = (([datetime]::Now, $end | Measure-Object -Minimum).Minimum - $started).TotalMinutes
Write-Log ('Kết thúc. {0} file, đã ghi {1:N0} phút trên {2:N0} phút của phiên. Ổ đĩa còn {3} GB.' -f `
  $files.Count, ($recorded / 60), $expected, (Get-FreeGB))
