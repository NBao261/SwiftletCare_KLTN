import { describe, expect, it } from 'vitest'
import { cameraHelpKeys, parseRtspInput, validateCameraSource } from '@/components/features/farm-owner/devices/cameraSource'

const VALID = { host: '203.0.113.7', port: '554', username: 'admin', password: 'mk', path: '/stream1' }

describe('địa chỉ camera IP của nút AI', () => {
  it('tách địa chỉ RTSP dán vào thành các ô, giải mã ký tự đặc biệt', () => {
    expect(parseRtspInput(' rtsp://admin:p%40ss@nha-yen.ddns.net:18554/cam/realmonitor?channel=1&subtype=0 ')).toEqual({
      host: 'nha-yen.ddns.net', port: '18554', username: 'admin', password: 'p@ss', path: '/cam/realmonitor?channel=1&subtype=0',
    })
    expect(parseRtspInput('rtsp://192.168.1.163/stream1')).toEqual({ host: '192.168.1.163', port: '554', username: '', password: '', path: '/stream1' })
    expect(parseRtspInput('http://192.168.1.163/stream1')).toBeNull()
    expect(parseRtspInput('không phải địa chỉ')).toBeNull()
  })

  it('kiểm ô cùng giới hạn với backend', () => {
    expect(validateCameraSource(VALID)).toEqual({})
    expect(validateCameraSource({ ...VALID, host: 'rtsp://x', port: '70000', path: 'stream1' })).toEqual({
      host: 'source.errorHost', port: 'source.errorPort', path: 'source.errorPath',
    })
    expect(validateCameraSource({ ...VALID, username: 'a'.repeat(65), password: 'b'.repeat(129) })).toEqual({
      username: 'source.errorUsername', password: 'source.errorPassword',
    })
  })
})

describe('cameraHelpKeys', () => {
  it('đã có hình thì không gợi ý gì', () => {
    expect(cameraHelpKeys('OK')).toEqual([])
  })

  it('mỗi lỗi có gợi ý riêng, không lẫn lỗi khác', () => {
    expect(cameraHelpKeys('AUTH_FAILED')).toEqual(['help.auth1', 'help.auth2'])
    expect(cameraHelpKeys('UNREACHABLE')).toEqual(['help.unreach1', 'help.unreach2', 'help.unreach3'])
    expect(cameraHelpKeys('NO_FRAMES')).toEqual(['help.noframes1', 'help.noframes2'])
    expect(cameraHelpKeys('NO_SOURCE')).toEqual(['help.nosource'])
  })

  it('chưa báo tình trạng thì bảo đợi, không đoán lỗi', () => {
    expect(cameraHelpKeys(null)).toEqual(['help.unknown'])
    expect(cameraHelpKeys(undefined)).toEqual(['help.unknown'])
  })
})
