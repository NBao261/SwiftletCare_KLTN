<#
.SYNOPSIS
  Tạo hai lịch Task Scheduler để laptop tự ghi phiên sáng và phiên chiều mỗi ngày.

.DESCRIPTION
  Giờ phiên đọc từ khối `sessions:` trong ai-pipeline/config/config.yaml, nhận cả hai dạng:
      morning_exit:                       MORNING_EXIT:  ["05:30", "07:00"]
        start: "05:30"
        end:   "07:00"
  Mỗi lịch bắt đầu sớm hơn và dừng muộn hơn giờ phiên -MarginMinutes phút.
  Mặc định 10 phút do nhóm tự chọn để không hụt đầu, cuối phiên; giờ chim bay đổi theo mùa,
  nên sửa config rồi chạy lại script này.

  Lịch chạy dưới tài khoản Windows đang đăng nhập (màn hình khóa vẫn chạy), tự đánh thức
  máy nếu Windows cho phép, và chạy bù ngay khi máy bật lại nếu lỡ giờ.

.EXAMPLE
  .\install_record_tasks.ps1                 # tạo hoặc cập nhật hai lịch
  .\install_record_tasks.ps1 -Uninstall      # gỡ hai lịch
#>
param(
  [string]$ConfigPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'config\config.yaml'),
  [ValidateRange(0, 60)][int]$MarginMinutes = 10,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$taskNames = @{ morning = 'SwiftletCare - ghi phien sang'; evening = 'SwiftletCare - ghi phien chieu' }

if ($Uninstall) {
  foreach ($name in $taskNames.Values) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $name -Confirm:$false
      Write-Host "Đã gỡ: $name"
    }
  }
  exit 0
}

function Read-Sessions([string]$path) {
  $sessions = @{}
  $inBlock = $false
  $current = $null
  foreach ($line in Get-Content $path) {
    if ($line -match '^sessions\s*:') { $inBlock = $true; continue }
    if (-not $inBlock) { continue }
    if ($line -match '^\s*(#|$)') { continue }                         # dòng trống, chú thích
    if ($line -match '^\S') { break }                                  # hết khối sessions
    $key = $null
    if ($line -match '^\s+(morning_exit|MORNING_EXIT)\s*:(.*)$') { $key = 'morning'; $rest = $Matches[2] }
    elseif ($line -match '^\s+(evening_entry|EVENING_ENTRY)\s*:(.*)$') { $key = 'evening'; $rest = $Matches[2] }
    if ($key) {
      $current = $key
      $sessions[$key] = @{}
      if ($rest -match '"(\d{2}:\d{2})"\s*,\s*"(\d{2}:\d{2})"') {     # dạng ["05:30", "07:00"]
        $sessions[$key].start = $Matches[1]; $sessions[$key].end = $Matches[2]
      }
      continue
    }
    if ($current -and $line -match '^\s+(start|end)\s*:\s*"?(\d{2}:\d{2})"?') {
      $sessions[$current][$Matches[1]] = $Matches[2]
    }
  }
  foreach ($k in 'morning', 'evening') {
    if (-not $sessions[$k] -or -not $sessions[$k].start -or -not $sessions[$k].end) {
      throw "Không đọc được giờ phiên '$k' trong $path (khối sessions:)."
    }
  }
  return $sessions
}

$sessions = Read-Sessions $ConfigPath
$script = Join-Path $PSScriptRoot 'record_session.ps1'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Warning 'Chưa có ffmpeg trong PATH. Cài bằng: winget install Gyan.FFmpeg, rồi mở lại PowerShell.'
}

foreach ($k in 'morning', 'evening') {
  $start = [datetime]::ParseExact($sessions[$k].start, 'HH:mm', $null).AddMinutes(-$MarginMinutes)
  $stop = [datetime]::ParseExact($sessions[$k].end, 'HH:mm', $null).AddMinutes($MarginMinutes)
  $until = $stop.ToString('HH:mm')

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $PSScriptRoot `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Session $k -Until $until"
  $trigger = New-ScheduledTaskTrigger -Daily -At $start
  $settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ($stop - $start + (New-TimeSpan -Minutes 30))
  Register-ScheduledTask -TaskName $taskNames[$k] -Action $action -Trigger $trigger -Settings $settings `
    -Description "Ghi RTSP camera nhà yến, phiên $k ($($sessions[$k].start)-$($sessions[$k].end) theo config)" `
    -Force | Out-Null
  Write-Host ("Đã đặt lịch '{0}': hằng ngày {1:HH:mm} → {2}" -f $taskNames[$k], $start, $until)
}

Write-Host ''
Write-Host 'Clip lưu ở ai-pipeline\clips, log ở ai-pipeline\clips\logs.'
Write-Host 'Laptop phải bật, cắm sạc, có mạng và đang đăng nhập Windows (khóa màn hình vẫn được) trong giờ ghi.'
