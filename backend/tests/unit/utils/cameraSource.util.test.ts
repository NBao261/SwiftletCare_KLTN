import { CAMERA_HOST_PATTERN, CAMERA_PATH_PATTERN, buildRtspUrl, parseRtspUrl } from '@/utils/cameraSource.util'

describe('cameraSource — địa chỉ RTSP của camera IP', () => {
  it('dựng URL, mã hoá ký tự đặc biệt của tài khoản và mật khẩu', () => {
    const fields = { host: '203.0.113.7', port: 18554, username: 'admin', path: '/stream1' }
    expect(buildRtspUrl(fields, 'p@ss:w/rd')).toBe('rtsp://admin:p%40ss%3Aw%2Frd@203.0.113.7:18554/stream1')
    expect(buildRtspUrl(fields, null)).toBe('rtsp://admin@203.0.113.7:18554/stream1')
    expect(buildRtspUrl({ ...fields, username: '' }, null)).toBe('rtsp://203.0.113.7:18554/stream1')
  })

  it('tách URL cũ thành các ô; dựng lại ra đúng URL', () => {
    const url = 'rtsp://admin:p%40ss@cam.example.vn:554/Streaming/Channels/101?transportmode=unicast'
    const parsed = parseRtspUrl(url)!
    expect(parsed).toEqual({
      host: 'cam.example.vn', port: 554, username: 'admin', path: '/Streaming/Channels/101?transportmode=unicast', password: 'p@ss',
    })
    expect(buildRtspUrl(parsed, parsed.password)).toBe(url)
    expect(parseRtspUrl('rtsp://192.168.1.10/live')).toMatchObject({ port: 554, username: '', password: null })
    expect(parseRtspUrl('http://x/y')).toBeNull()
    expect(parseRtspUrl('không phải url')).toBeNull()
  })

  it('kiểm ô địa chỉ và đường dẫn', () => {
    expect(CAMERA_HOST_PATTERN.test('192.168.1.163')).toBe(true)
    expect(CAMERA_HOST_PATTERN.test('nha-yen.ddns.net')).toBe(true)
    expect(CAMERA_HOST_PATTERN.test('rtsp://x')).toBe(false)
    expect(CAMERA_HOST_PATTERN.test('x:554')).toBe(false)
    expect(CAMERA_PATH_PATTERN.test('/stream1')).toBe(true)
    expect(CAMERA_PATH_PATTERN.test('stream1')).toBe(false)
    expect(CAMERA_PATH_PATTERN.test('/a b')).toBe(false)
  })
})
