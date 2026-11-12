import { describe, expect, it } from '@jest/globals'
import {
  canAddRingPoint,
  getCountingRingErrorMessage,
  getVideoAspectRatio,
  isRingChanged,
  isRingComplete,
  type RingPoint,
  toRingPoint,
  toSvgPoints,
} from '@/utils/countingRing.utils'

function buildPoints(count: number): RingPoint[] {
  return Array.from({ length: count }, (_, index) => [index / 20, index / 20] as RingPoint)
}

describe('toRingPoint', () => {
  it('đổi điểm chạm sang tỉ lệ 0–1, giữ 3 chữ số thập phân', () => {
    expect(toRingPoint(100, 50, 400, 200)).toEqual([0.25, 0.25])
    expect(toRingPoint(1, 2, 3, 3)).toEqual([0.333, 0.667])
  })

  it('kẹp điểm ra ngoài khung về mép, khung chưa đo được thì về góc', () => {
    expect(toRingPoint(-10, 500, 400, 200)).toEqual([0, 1])
    expect(toRingPoint(10, 10, 0, 0)).toEqual([0, 0])
  })
})

describe('toSvgPoints', () => {
  it('đổi tỉ lệ sang px theo kích thước khung', () => {
    expect(toSvgPoints([[0.5, 0.25], [1, 1]], 200, 100)).toBe('100,25 200,100')
  })
})

describe('số đỉnh của vòng', () => {
  it('cần 3–12 đỉnh, đủ 12 thì không thêm nữa', () => {
    expect(isRingComplete(buildPoints(2))).toBe(false)
    expect(isRingComplete(buildPoints(3))).toBe(true)
    expect(isRingComplete(buildPoints(12))).toBe(true)
    expect(canAddRingPoint(buildPoints(11))).toBe(true)
    expect(canAddRingPoint(buildPoints(12))).toBe(false)
  })
})

describe('getVideoAspectRatio', () => {
  it('lấy tỉ lệ của luồng, chưa biết thì 16:9', () => {
    expect(getVideoAspectRatio({ width: 1280, height: 960 })).toBeCloseTo(4 / 3)
    expect(getVideoAspectRatio(null)).toBeCloseTo(16 / 9)
    expect(getVideoAspectRatio({ width: 0, height: 0 })).toBeCloseTo(16 / 9)
  })
})

describe('isRingChanged', () => {
  const saved = { points: buildPoints(3), into_ring_is_exit: true }

  it('giống vòng đang lưu thì không đổi', () => {
    expect(isRingChanged(saved, buildPoints(3), true)).toBe(false)
  })

  it('khác điểm, số điểm hoặc chiều thì là đổi', () => {
    expect(isRingChanged(saved, buildPoints(4), true)).toBe(true)
    expect(isRingChanged(saved, buildPoints(3), false)).toBe(true)
    expect(isRingChanged(saved, [[0.9, 0.9], ...buildPoints(3).slice(1)], true)).toBe(true)
  })

  it('chưa có vòng nào: chạm điểm hoặc chọn chiều là đổi', () => {
    expect(isRingChanged(null, [], null)).toBe(false)
    expect(isRingChanged(null, buildPoints(1), null)).toBe(true)
    expect(isRingChanged(undefined, [], false)).toBe(true)
  })
})

describe('getCountingRingErrorMessage', () => {
  function backendError(status: number) {
    return { response: { status, data: { success: false, error: { code: 'X', message: 'x' } } } }
  }

  it('câu riêng cho 403, 409, 422', () => {
    expect(getCountingRingErrorMessage(backendError(403))).toBe('Bạn không có quyền vẽ vòng đếm của camera này')
    expect(getCountingRingErrorMessage(backendError(409))).toBe('Camera đã bị gỡ khỏi hệ thống')
    expect(getCountingRingErrorMessage(backendError(422))).toBe('Vòng đếm cần từ 3 đến 12 điểm trong khung hình')
  })
})
