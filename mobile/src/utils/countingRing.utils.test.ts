import { describe, expect, it } from '@jest/globals'
import type { CountingRing } from '@/types'
import {
  areRingsComplete,
  createSquareRing,
  dragRingPoint,
  findNearestVertex,
  findRingAt,
  getCountingRingErrorMessage,
  getVideoAspectRatio,
  isRingComplete,
  isRingListChanged,
  moveRingVertex,
  pickFreeRingCenter,
  removeRingAt,
  ringsOfCamera,
  type RingPoint,
  toRingPoint,
  toSvgPoints,
} from '@/utils/countingRing.utils'

function buildPoints(count: number): RingPoint[] {
  return Array.from({ length: count }, (_, index) => [index / 20, index / 20] as RingPoint)
}

// Khung vuông 0,2–0,4 theo cả hai trục
const square: CountingRing = {
  points: [
    [0.2, 0.2],
    [0.4, 0.2],
    [0.4, 0.4],
    [0.2, 0.4],
  ],
  into_ring_is_exit: true,
}

describe('toRingPoint', () => {
  it('đổi điểm chạm sang tỉ lệ 0–1, giữ 3 chữ số thập phân', () => {
    expect(toRingPoint(100, 50, 400, 200)).toEqual([0.25, 0.25])
    expect(toRingPoint(1, 1, 3, 3)).toEqual([0.333, 0.333])
  })

  it('kẹp điểm ra ngoài khung về mép, khung chưa đo được thì về góc', () => {
    expect(toRingPoint(-10, 500, 400, 200)).toEqual([0, 1])
    expect(toRingPoint(10, 10, 0, 0)).toEqual([0, 0])
  })
})

describe('toSvgPoints, số đỉnh, tỉ lệ khung', () => {
  it('đổi tỉ lệ sang px theo kích thước khung', () => {
    expect(toSvgPoints([[0.5, 0.25]], 400, 200)).toBe('200,50')
  })

  it('vòng cần 3–12 đỉnh', () => {
    expect(isRingComplete(buildPoints(2))).toBe(false)
    expect(isRingComplete(buildPoints(4))).toBe(true)
    expect(isRingComplete(buildPoints(13))).toBe(false)
  })

  it('lấy tỉ lệ của luồng, chưa biết thì 16:9', () => {
    expect(getVideoAspectRatio({ width: 1280, height: 960 })).toBeCloseTo(4 / 3)
    expect(getVideoAspectRatio(null)).toBeCloseTo(16 / 9)
  })
})

describe('khung vuông mặc định', () => {
  it('khung mới vuông trên màn hình: cạnh dọc theo tỉ lệ khung hình, 4 góc theo chiều kim đồng hồ', () => {
    const ring = createSquareRing([0.5, 0.5], 2, false)
    expect(ring.points).toEqual([
      [0.35, 0.2],
      [0.65, 0.2],
      [0.65, 0.8],
      [0.35, 0.8],
    ])
    expect(ring.into_ring_is_exit).toBe(false)
  })

  it('tâm khung mới chọn chỗ còn trống, lần lượt trái rồi phải', () => {
    expect(pickFreeRingCenter([])).toEqual([0.3, 0.5])
    expect(pickFreeRingCenter([createSquareRing([0.3, 0.5], 16 / 9, true)])).toEqual([0.7, 0.5])
  })
})

describe('kéo góc và chọn khung', () => {
  const frame = { width: 400, height: 200 }

  it('bắt góc gần nhất trong bán kính chạm; xa quá thì không bắt', () => {
    expect(findNearestVertex([square], { x: 85, y: 42 }, frame, 32, 0)).toEqual({ ringIndex: 0, pointIndex: 0 })
    expect(findNearestVertex([square], { x: 300, y: 150 }, frame, 32, 0)).toBeNull()
  })

  it('hai góc chồng nhau thì góc của vòng đang chọn thắng', () => {
    const other = { ...square, into_ring_is_exit: false }
    expect(findNearestVertex([square, other], { x: 80, y: 40 }, frame, 32, 1)).toEqual({ ringIndex: 1, pointIndex: 0 })
  })

  it('kéo một góc chỉ đổi góc đó, vòng khác giữ nguyên', () => {
    const other = createSquareRing([0.7, 0.5], 2, false)
    const moved = moveRingVertex([square, other], { ringIndex: 0, pointIndex: 2 }, [0.5, 0.5])
    expect(moved[0].points[2]).toEqual([0.5, 0.5])
    expect(moved[0].points[0]).toEqual([0.2, 0.2])
    expect(moved[1]).toEqual(other)
  })

  it('chạm giữa khung thì chọn khung đó, chạm ngoài thì không chọn', () => {
    expect(findRingAt([square], [0.3, 0.3])).toBe(0)
    expect(findRingAt([square], [0.8, 0.8])).toBe(-1)
  })
})

describe('nhiều vòng (VISION-FR-018)', () => {
  it('giống các vòng đang lưu thì không đổi; khác số vòng, đỉnh hoặc chiều thì là đổi', () => {
    const moved = moveRingVertex([square], { ringIndex: 0, pointIndex: 1 }, [0.5, 0.2])
    expect(isRingListChanged([square], [square])).toBe(false)
    expect(isRingListChanged([], [])).toBe(false)
    expect(isRingListChanged([square], [])).toBe(true)
    expect(isRingListChanged([square], [{ ...square, into_ring_is_exit: false }])).toBe(true)
    expect(isRingListChanged([square], moved)).toBe(true)
  })

  it('mọi vòng phải đủ đỉnh; không vòng nào là hợp lệ (dùng vòng mặc định)', () => {
    expect(areRingsComplete([square, { points: buildPoints(2), into_ring_is_exit: true }])).toBe(false)
    expect(areRingsComplete([square])).toBe(true)
    expect(areRingsComplete([])).toBe(true)
  })

  it('bỏ một vòng thì chọn vòng cuối còn lại', () => {
    const second = { ...square, into_ring_is_exit: false }
    expect(removeRingAt([square, second, square], 0)).toEqual({ rings: [second, square], activeIndex: 1 })
    expect(removeRingAt([square], 0)).toEqual({ rings: [], activeIndex: 0 })
  })

  it('bản ghi cũ chỉ có counting_ring vẫn đọc được', () => {
    expect(ringsOfCamera({ counting_ring: { ...square, updated_at: 'x' } })).toEqual([square])
    expect(ringsOfCamera({ counting_rings: [], counting_ring: square })).toEqual([])
  })
})

describe('getCountingRingErrorMessage', () => {
  function backendError(status: number) {
    return { response: { status, data: { success: false, error: { code: 'X', message: 'x' } } } }
  }

  it('câu riêng cho 403, 409, 422', () => {
    expect(getCountingRingErrorMessage(backendError(403))).toBe('Bạn không có quyền vẽ vòng đếm của camera này')
    expect(getCountingRingErrorMessage(backendError(409))).toBe('Camera đã bị gỡ khỏi hệ thống')
    expect(getCountingRingErrorMessage(backendError(422))).toBe(
      'Mỗi vòng cần từ 3 đến 12 điểm trong khung hình, hai vòng không được trùng nhau',
    )
  })
})

describe('dragRingPoint', () => {
  const frame = { width: 400, height: 200 }

  it('góc đi theo quãng ngón tay từ chỗ nó đang đứng, không nhảy tới điểm chạm', () => {
    expect(dragRingPoint([0.5, 0.5], { x: 40, y: -20 }, frame)).toEqual([0.6, 0.4])
    expect(dragRingPoint([0.25, 0.75], { x: 0, y: 0 }, frame)).toEqual([0.25, 0.75])
  })

  it('kéo quá mép thì kẹp trong khung', () => {
    expect(dragRingPoint([0.9, 0.1], { x: 400, y: -400 }, frame)).toEqual([1, 0])
  })
})
