import { describe, expect, it } from 'vitest'
import { validateAudioUpload } from '@/validations/farm-owner/audioTrack.validation'

const mp3 = (size = 1000, name = 'ru.mp3', type = 'audio/mpeg') => ({ name, size, type }) as File
const input = (overrides: Partial<{ file: File | null; trackNumber: string; displayName: string }> = {}) =>
  ({ file: mp3(), trackNumber: '2', displayName: 'Bài ru 1', ...overrides })

describe('validateAudioUpload', () => {
  it('nhận file mp3 hợp lệ', () => {
    expect(validateAudioUpload(input())).toEqual({})
  })

  it('từ chối file thiếu, sai đuôi, sai MIME, trống hoặc quá 10MB', () => {
    expect(validateAudioUpload(input({ file: null })).file).toBe('Chọn 1 file .mp3')
    expect(validateAudioUpload(input({ file: mp3(1000, 'ru.wav') })).file).toBe('Chỉ nhận file .mp3')
    expect(validateAudioUpload(input({ file: mp3(1000, 'ru.mp3', 'text/html') })).file).toBe('File không phải âm thanh MP3')
    expect(validateAudioUpload(input({ file: mp3(0) })).file).toBe('File trống')
    expect(validateAudioUpload(input({ file: mp3(10 * 1024 * 1024 + 1) })).file).toBe('File vượt quá 10MB')
  })

  it('tên bài từ 1 đến 100 ký tự', () => {
    expect(validateAudioUpload(input({ displayName: '  ' })).displayName).toBe('Nhập tên bài')
    expect(validateAudioUpload(input({ displayName: 'a'.repeat(100) }))).toEqual({})
    expect(validateAudioUpload(input({ displayName: 'a'.repeat(101) })).displayName).toBe('Tên bài tối đa 100 ký tự')
  })

  it('số thứ tự là số nguyên 1–255', () => {
    for (const trackNumber of ['0', '256', '1.5', '', 'abc']) {
      expect(validateAudioUpload(input({ trackNumber })).trackNumber).toBeDefined()
    }
    expect(validateAudioUpload(input({ trackNumber: '255' }))).toEqual({})
  })
})
