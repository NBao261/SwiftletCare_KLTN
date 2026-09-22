/** SRS §12.4 — cùng giới hạn với backend (multer 10MB) */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
/** DFPlayer Mini đọc tối đa 255 bài/thư mục (0001.mp3 … 0255.mp3) */
export const MAX_TRACK_NUMBER = 255

export type AudioUploadField = 'file' | 'trackNumber' | 'displayName'

/** Validate form upload file loa ru (ENV-FR-013c(a)) — map lỗi theo field, rỗng = hợp lệ */
export function validateAudioUpload(input: { file: File | null; trackNumber: string; displayName: string }): Partial<Record<AudioUploadField, string>> {
  const errors: Partial<Record<AudioUploadField, string>> = {}
  if (!input.file) errors.file = 'Chọn 1 file .mp3'
  else if (!/\.mp3$/i.test(input.file.name)) errors.file = 'Chỉ nhận file .mp3'
  else if (input.file.size > MAX_AUDIO_BYTES) errors.file = 'File vượt quá 10MB'

  const n = Number(input.trackNumber)
  if (!Number.isInteger(n) || n < 1 || n > MAX_TRACK_NUMBER) {
    errors.trackNumber = `Số thứ tự là số nguyên 1–${MAX_TRACK_NUMBER}, trùng tên file trên thẻ SD (2 = 0002.mp3)`
  }
  if (!input.displayName.trim()) errors.displayName = 'Nhập tên bài'
  return errors
}
