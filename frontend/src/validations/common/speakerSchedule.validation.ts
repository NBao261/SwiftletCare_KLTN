import type { SpeakerWindow } from '@/types'

// Firmware chỉ có 2 khung giờ, theo giờ tròn (AudioManager:updateSchedule)
export const MAX_SPEAKER_WINDOWS = 2

// "05:00" … "24:00": giá trị hợp lệ cho ô chọn giờ
export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

// Cùng luật với backend; trả lỗi đầu tiên hoặc null
export function validateSpeakerWindows(windows: SpeakerWindow[]): string | null {
  if (windows.length === 0) return 'Cần ít nhất 1 khung giờ (muốn tắt hẳn thì tắt "Phát theo lịch")'
  if (windows.length > MAX_SPEAKER_WINDOWS) return `Thiết bị chỉ hỗ trợ tối đa ${MAX_SPEAKER_WINDOWS} khung giờ`
  const bad = windows.findIndex(w => w.start >= w.end)
  if (bad >= 0) return `Khung ${bad + 1}: giờ bắt đầu phải trước giờ kết thúc`
  return null
}
