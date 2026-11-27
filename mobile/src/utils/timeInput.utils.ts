import { t } from '@/utils/i18n.utils'

// Ô giờ HH:mm và ô ngày trong năm MM-DD gõ bằng bàn phím số: tự chèn dấu phân cách khi gõ và báo lỗi ngay khi chữ đã chắc
// chắn sai (25 giờ, phút 7x, tháng 13), không đợi bấm Lưu

const MAX_HOUR = 23
const MAX_MINUTE = 59
const MAX_MONTH = 12
// Số ngày tối đa của từng tháng (tháng 2 tính 29 vì hồ sơ lặp mỗi năm, như countingSchedule.utils dayOfYear)
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Giữ tối đa 4 chữ số rồi chèn dấu sau 2 chữ số đầu. Chỉ khi ô mới có một chữ số lớn hơn `firstDigitMax` thì thêm "0" phía
// trước ("5" thành "05" vì không có giờ 50, không có tháng 5x); ô đã nhiều chữ số thì giữ nguyên để xoá, sửa giữa chừng không
// bị chèn lại "0" (chữ sai thì báo lỗi)
function formatTwoPartInput(text: string, separator: string, firstDigitMax: number): string {
  let digits = text.replace(/\D/g, '')
  if (digits.length === 1 && Number(digits) > firstDigitMax) digits = `0${digits}`
  digits = digits.slice(0, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}${separator}${digits.slice(2)}`
}

// "0530" → "05:30", "5" → "05", "123" → "12:3"
export function formatTimeInput(text: string): string {
  return formatTwoPartInput(text, ':', 2)
}

// "0315" → "03-15", "9" → "09"
export function formatMonthDayInput(text: string): string {
  return formatTwoPartInput(text, '-', 1)
}

// Giờ đã gõ đủ HH:mm và hợp lệ
export function isCompleteTime(text: string): boolean {
  return /^\d{2}:\d{2}$/.test(text) && getTimeInputError(text) === null
}

// Lỗi của ô giờ đang gõ: báo ngay khi giờ quá 23 hoặc phút quá 59; trống hoặc chưa gõ xong mà chưa sai thì null
export function getTimeInputError(text: string): string | null {
  const [hour = '', minute = ''] = text.split(':')
  if (hour.length === 2 && Number(hour) > MAX_HOUR) return t('Giờ từ 00 đến 23')
  if ((minute.length >= 1 && Number(minute[0]) > 5) || (minute.length === 2 && Number(minute) > MAX_MINUTE)) {
    return t('Phút từ 00 đến 59')
  }
  return null
}

// Lỗi của ô ngày MM-DD đang gõ: tháng 01–12, ngày không quá số ngày của tháng; chưa gõ xong mà chưa sai thì null
export function getMonthDayInputError(text: string): string | null {
  const [month = '', day = ''] = text.split('-')
  const monthNumber = Number(month)
  if (month.length === 2 && (monthNumber < 1 || monthNumber > MAX_MONTH)) return t('Tháng từ 01 đến 12')
  if (day.length === 2) {
    const maxDay = month.length === 2 ? DAYS_IN_MONTH[monthNumber - 1] : 31
    if (Number(day) < 1 || Number(day) > maxDay) return t('Ngày từ 01 đến {max}', { max: maxDay })
  }
  return null
}

// Khung giờ (bắt đầu, kết thúc) đã gõ xong: bắt đầu phải trước kết thúc; chưa gõ xong thì null
export function getTimeRangeError(start: string, end: string): string | null {
  if (!isCompleteTime(start) || !isCompleteTime(end)) return null
  return start >= end ? t('Giờ kết thúc phải sau giờ bắt đầu') : null
}
