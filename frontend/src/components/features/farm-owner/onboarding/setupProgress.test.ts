import { describe, expect, it } from 'vitest'

import { SETUP_TIMEOUT_MS, evaluateSetup, type SetupInput } from '@/components/features/farm-owner/onboarding/setupProgress'

const REGISTERED = '2026-11-26T07:00:00.000Z'
const registeredMs = new Date(REGISTERED).getTime()

const base: SetupInput = {
  isCamera: false, now: registeredMs + 60_000, registeredAt: REGISTERED, startedAt: registeredMs,
  socketOnline: false, formatTime: iso => `T(${iso.slice(11, 16)})`,
}

const stepOf = (input: SetupInput, id: string) => evaluateSetup(input).steps.find(step => step.id === id)

describe('tiến trình chờ thiết bị kết nối', () => {
  it('mới đăng ký: chờ tín hiệu đầu tiên và nói rõ chưa nhận gì', () => {
    const progress = evaluateSetup(base)
    expect(progress.verdict).toBe('waiting')
    expect(progress.steps.map(step => step.state)).toEqual(['done', 'active', 'pending'])
    expect(progress.steps[0].detail).toBe('Lúc T(07:00)')
    expect(progress.steps[1].detail).toBe('Chưa nhận được tín hiệu nào từ thiết bị')
  })

  it('đếm thời gian từ lúc đăng ký, không phải lúc mở màn (tải lại trang không làm lại 15 phút)', () => {
    const progress = evaluateSetup({ ...base, now: registeredMs + 10 * 60_000, startedAt: registeredMs + 9 * 60_000 })
    expect(progress.remainingMs).toBe(5 * 60_000)
  })

  it('quá 15 phút chưa có tín hiệu: quá hạn, bước tín hiệu thất bại', () => {
    const progress = evaluateSetup({ ...base, now: registeredMs + SETUP_TIMEOUT_MS + 1000 })
    expect(progress.verdict).toBe('timed-out')
    expect(progress.steps[1]).toMatchObject({ state: 'failed', detail: 'Không nhận được tín hiệu nào trong 15 phút' })
  })

  it('online và cấu hình đã áp: sẵn sàng; firmware cũ không báo phiên bản thì nói chưa xác nhận được', () => {
    const ready = evaluateSetup({ ...base, status: 'ONLINE', lastHeartbeat: '2026-11-26T07:03:00.000Z', configSync: 'APPLIED' })
    expect(ready.verdict).toBe('ready')
    expect(ready.steps.map(step => step.state)).toEqual(['done', 'done', 'done'])
    expect(ready.steps[1].detail).toBe('Lần kết nối cuối lúc T(07:03)')

    const unknown = evaluateSetup({ ...base, status: 'ONLINE', configSync: 'UNKNOWN' })
    expect(unknown.verdict).toBe('ready')
    expect(unknown.steps[2].detail).toContain('chưa xác nhận được')
  })

  it('online nhưng cấu hình chưa áp: đang chờ; lệch phiên bản hoặc quá hạn thì kẹt ở cấu hình, không phải lỗi Wi-Fi', () => {
    expect(evaluateSetup({ ...base, status: 'ONLINE', configSync: 'PENDING' })).toMatchObject({ verdict: 'waiting' })
    expect(stepOf({ ...base, status: 'ONLINE', configSync: 'PENDING' }, 'config')?.state).toBe('active')
    expect(evaluateSetup({ ...base, status: 'ONLINE', configSync: 'MISMATCH' }).verdict).toBe('config-stuck')
    expect(evaluateSetup({ ...base, status: 'ONLINE', configSync: 'PENDING', now: registeredMs + SETUP_TIMEOUT_MS + 1000 }).verdict).toBe('config-stuck')
  })

  it('sự kiện socket báo online trước khi đọc lại trạng thái', () => {
    expect(evaluateSetup({ ...base, socketOnline: true, configSync: 'APPLIED' }).verdict).toBe('ready')
  })

  describe('camera đếm chim', () => {
    const camera: SetupInput = { ...base, isCamera: true, status: 'ONLINE' }

    it('nút AI online là sẵn sàng; chưa nhập địa chỉ camera là việc của Chủ nhà yến, không phải lỗi', () => {
      const progress = evaluateSetup({ ...camera, cameraStatus: 'NO_SOURCE' })
      expect(progress.verdict).toBe('ready')
      expect(progress.steps[2]).toMatchObject({ state: 'pending' })
      expect(progress.steps[2].detail).toContain('Chủ nhà yến nhập')
    })

    it('nói đúng lý do khi camera IP không có hình', () => {
      expect(evaluateSetup({ ...camera, cameraStatus: 'AUTH_FAILED' }).steps[2]).toMatchObject({ state: 'failed', detail: 'Sai tài khoản hoặc mật khẩu camera' })
      expect(evaluateSetup({ ...camera, cameraStatus: 'UNREACHABLE' }).steps[2].detail).toBe('Không kết nối được camera')
      expect(evaluateSetup({ ...camera, cameraStatus: 'OK' }).steps[2].state).toBe('done')
    })
  })
})
