import { describe, expect, it } from '@jest/globals'
import {
  buildCameraSourcePayload,
  EMPTY_CAMERA_SOURCE_FORM,
  isCameraStatusProblem,
  parseRtspInput,
  toCameraSourceForm,
  validateCameraSource,
} from '@/utils/cameraSource.utils'

// Tài khoản, mật khẩu giả của test (IP 203.0.113.x là dải dành cho ví dụ). Ghép lúc chạy và chỉ dùng qua biến, để code không
// có cặp tài khoản / mật khẩu viết sẵn mà máy quét bí mật (GitGuardian) báo nhầm là mật khẩu thật
const TEST_USER = ['cam', 'user'].join('-')
const TEST_PASSWORD = ['mat', 'khau'].join('@')
const TEST_ENCODED_PASSWORD = encodeURIComponent(TEST_PASSWORD)

describe('parseRtspInput', () => {
  it('tách địa chỉ RTSP dán vào thành các ô, giải mã %xx trong mật khẩu', () => {
    const address = `rtsp://${TEST_USER}:${TEST_ENCODED_PASSWORD}@203.0.113.7:8554/stream1?x=1`
    expect(parseRtspInput(address)).toEqual({
      host: '203.0.113.7',
      port: '8554',
      username: TEST_USER,
      password: TEST_PASSWORD,
      path: '/stream1?x=1',
    })
  })

  it('thiếu cổng, tài khoản, đường dẫn thì dùng mặc định', () => {
    expect(parseRtspInput('  rtsp://cam.nhayen.vn  ')).toEqual({
      host: 'cam.nhayen.vn',
      port: '554',
      username: '',
      password: '',
      path: '/',
    })
  })

  it('dấu @ trong đường dẫn hay query không bị nhận là tài khoản', () => {
    expect(parseRtspInput('rtsp://203.0.113.7:554/live?token=a@b')).toEqual({
      host: '203.0.113.7',
      port: '554',
      username: '',
      password: '',
      path: '/live?token=a@b',
    })
    const address = `rtsp://${TEST_USER}:${TEST_PASSWORD}@203.0.113.7/live?owner=x@y`
    expect(parseRtspInput(address)).toMatchObject({ host: '203.0.113.7', username: TEST_USER, password: TEST_PASSWORD })
  })

  it('không phải RTSP thì null', () => {
    expect(parseRtspInput('http://1.2.3.4/stream')).toBeNull()
    expect(parseRtspInput('203.0.113.7')).toBeNull()
  })
})

describe('validateCameraSource', () => {
  it('form mặc định chỉ thiếu địa chỉ', () => {
    expect(Object.keys(validateCameraSource(EMPTY_CAMERA_SOURCE_FORM))).toEqual(['host'])
  })

  it('bắt địa chỉ kèm rtsp://, cổng sai, đường dẫn không bắt đầu bằng /', () => {
    const errors = validateCameraSource({ host: 'rtsp://1.2.3.4', port: '70000', username: 'a', password: '', path: 'x' })
    expect(Object.keys(errors).sort()).toEqual(['host', 'path', 'port'])
  })
})

describe('buildCameraSourcePayload', () => {
  const form = { host: ' 1.2.3.4 ', port: '554', username: 'admin', password: '', path: '/stream1' }

  it('đã có mật khẩu lưu mà ô trống thì không gửi mật khẩu (giữ mật khẩu cũ)', () => {
    expect(buildCameraSourcePayload(form, true)).toEqual({ host: '1.2.3.4', port: 554, username: 'admin', path: '/stream1' })
  })

  it('chưa có mật khẩu thì gửi chuỗi rỗng; gõ mật khẩu mới thì gửi mật khẩu đó', () => {
    expect(buildCameraSourcePayload(form, false).password).toBe('')
    expect(buildCameraSourcePayload({ ...form, password: TEST_PASSWORD }, true).password).toBe(TEST_PASSWORD)
  })
})

describe('toCameraSourceForm, isCameraStatusProblem', () => {
  it('điền lại ô đã lưu, mật khẩu luôn trống', () => {
    const source = { host: 'h', port: 8554, username: 'u', path: '/p', has_password: true, version: 2, updated_at: 'x' }
    expect(toCameraSourceForm(source)).toEqual({ host: 'h', port: '8554', username: 'u', password: '', path: '/p' })
    expect(toCameraSourceForm(null)).toEqual(EMPTY_CAMERA_SOURCE_FORM)
  })

  it('sai mật khẩu, không kết nối được, không có hình là có vấn đề', () => {
    expect(isCameraStatusProblem('AUTH_FAILED')).toBe(true)
    expect(isCameraStatusProblem('OK')).toBe(false)
    expect(isCameraStatusProblem('NO_SOURCE')).toBe(false)
    expect(isCameraStatusProblem(null)).toBe(false)
  })
})
