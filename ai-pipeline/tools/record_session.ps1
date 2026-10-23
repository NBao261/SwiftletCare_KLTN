# Quay clip RTSP của camera nhà yến cho tới giờ -End (HH:mm hôm nay), plan 7.1.
# Task Scheduler gọi mỗi ngày lúc 05:15 và 17:15 (WakeToRun; máy phải cắm sạc và ở Sleep, không Shut down):
#   powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File <ai-pipeline>\tools\record_session.ps1 -Label morning -End 07:15
# Mật khẩu camera đọc từ ai-pipeline\.env lúc chạy, không chép vào đây. Clip và log để ở ổ D (plan 7.1).
# File lưu UTF-8 có BOM: PowerShell 5.1 đọc file không BOM theo bảng mã ANSI, chữ tiếng Việt trong log sẽ hỏng.
param(
    [Parameter(Mandatory)] [string] $Label,
    [Parameter(Mandatory)] [string] $End,
    [string] $EnvFile = (Join-Path $PSScriptRoot "..\.env"),
    [string] $OutDir = "D:\SwiftletCare\clips",
    [string] $LogDir = "D:\SwiftletCare\logs"
)

$logDir = $LogDir
New-Item -ItemType Directory -Force $logDir, $OutDir | Out-Null
function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Label] $msg" | Add-Content -Encoding utf8 "$logDir\record.log" }

$endTime = [datetime]::ParseExact($End, 'HH:mm', $null)
if ((Get-Date) -ge $endTime) { Log "đã quá $End, bỏ qua"; exit 0 }

$url = (Get-Content $EnvFile | Where-Object { $_ -like 'CAMERA_RTSP_URL=*' } | Select-Object -First 1) -replace '^CAMERA_RTSP_URL=', ''
if (-not $url) { Log "thiếu CAMERA_RTSP_URL trong $EnvFile"; exit 1 }

# Lần chạy trước bị dừng ngang (22/10 17:56) để lại .part.mp4 chưa đóng gói lại: làm nốt trước khi quay.
# MultipleInstances=IgnoreNew nên lúc này không còn lần chạy nào khác đang ghi các file đó.
Get-ChildItem $OutDir -Filter '*.part.mp4' | ForEach-Object {
    $done = $_.FullName -replace '\.part\.mp4$', '.mp4'
    & ffmpeg -nostdin -loglevel error -i $_.FullName -c copy -movflags +faststart $done
    if ($LASTEXITCODE -eq 0 -and (Test-Path $done)) { Remove-Item $_.FullName; Log "đóng gói lại file sót: $done" }
    else { Remove-Item $done -ErrorAction SilentlyContinue; Log "file sót không đóng gói lại được, giữ $($_.Name)" }
}

# Giữ máy thức trong lúc quay: máy được wake timer đánh thức sẽ ngủ lại sau ~2 phút nếu không có yêu cầu này
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
[Win32.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED (0x80000001)

$day = Get-Date -Format 'yyyyMMdd'
while (($left = [int]($endTime - (Get-Date)).TotalSeconds) -gt 5) {
    $n = 1
    while ((Test-Path ("{0}\{1}_{2}_{3:d2}.mp4" -f $OutDir, $day, $Label, $n)) -or
           (Test-Path ("{0}\{1}_{2}_{3:d2}.part.mp4" -f $OutDir, $day, $Label, $n))) { $n++ }
    $out = "{0}\{1}_{2}_{3:d2}.mp4" -f $OutDir, $day, $Label, $n
    $part = $out -replace '\.mp4$', '.part.mp4'
    Log "quay $part trong $left s"
    # -c copy: không nén lại; fragmented mp4 để file vẫn xem được nếu bị ngắt giữa chừng
    & ffmpeg -nostdin -loglevel error -rtsp_transport tcp -timeout 10000000 -i $url `
        -map 0:v -c copy -t $left -movflags +frag_keyframe+empty_moov $part
    Log "ffmpeg thoát mã $LASTEXITCODE, $([math]::Round((Get-Item $part -ErrorAction SilentlyContinue).Length / 1MB)) MB"
    # Fragmented mp4 không có chỉ mục nên không tua được: đóng gói lại thành mp4 thường (vài giây, không nén lại).
    # Lỗi thì giữ nguyên file .part.mp4 — vẫn xem được, chỉ không tua.
    if (Test-Path $part) {
        & ffmpeg -nostdin -loglevel error -i $part -c copy -movflags +faststart $out
        if ($LASTEXITCODE -eq 0 -and (Test-Path $out)) { Remove-Item $part; Log "đóng gói lại xong: $out" }
        else { Remove-Item $out -ErrorAction SilentlyContinue; Log "đóng gói lại lỗi (mã $LASTEXITCODE), giữ $part" }
    }
    if ((Get-Date) -lt $endTime.AddSeconds(-5)) { Start-Sleep -Seconds 10 }   # mất kết nối: chờ rồi quay file mới
}
# Luồng camera đứng hình > 10 giây (mạng chập chờn) làm ffmpeg dừng sớm và phiên bị chia nhiều đoạn
# (23/10: 3 đoạn). Hết phiên thì gộp lại thành 1 file; chỉ xóa đoạn lẻ khi tổng thời lượng khớp.
$parts = @(Get-ChildItem $OutDir -Filter "${day}_${Label}_*.mp4" | Where-Object { $_.Name -notlike '*.part.mp4' } | Sort-Object Name)
if ($parts.Count -gt 1) {
    $list = Join-Path $OutDir "concat_${day}_${Label}.txt"
    $merged = Join-Path $OutDir "${day}_${Label}_merged.mp4"
    $parts | ForEach-Object { "file '" + ($_.FullName -replace '\\', '/') + "'" } | Set-Content -Encoding ascii $list
    # -auto_convert 0: đoạn bị ngắt đột ngột có gói hình cuối cắt dở; bộ lọc h264_mp4toannexb mà concat tự chèn
    # gặp gói đó thì dừng cả việc gộp (thử 23/10: ra 13 s thay vì 23 s). Không cần bộ lọc này khi gộp mp4 sang mp4.
    & ffmpeg -nostdin -loglevel error -f concat -safe 0 -auto_convert 0 -i $list -c copy -movflags +faststart $merged
    $dur = { param($f) [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $f) }
    $sum = ($parts | ForEach-Object { & $dur $_.FullName } | Measure-Object -Sum).Sum
    $got = if (Test-Path $merged) { & $dur $merged } else { 0 }
    if ($LASTEXITCODE -eq 0 -and [math]::Abs($got - $sum) -lt 2) {
        $parts | Remove-Item
        Move-Item $merged (Join-Path $OutDir "${day}_${Label}_01.mp4")
        Log ("gộp {0} đoạn thành {1}_{2}_01.mp4 ({3:N0} s)" -f $parts.Count, $day, $Label, $got)
    } else {
        Remove-Item $merged -ErrorAction SilentlyContinue
        Log ("gộp {0} đoạn lỗi (thời lượng {1:N0} s, mong đợi {2:N0} s), giữ các đoạn lẻ" -f $parts.Count, $got, $sum)
    }
    Remove-Item $list -ErrorAction SilentlyContinue
}
[Win32.Power]::SetThreadExecutionState([uint32]2147483648) | Out-Null   # trả máy về chế độ ngủ bình thường
Log "xong"
