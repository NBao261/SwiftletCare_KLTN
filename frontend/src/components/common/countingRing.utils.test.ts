import { describe, expect, it } from 'vitest'
import { placePoint, removeRing, ringList, ringsOfCamera, shownRings } from '@/components/common/countingRing.utils'
import type { CountingRing } from '@/types'

const RING: CountingRing = { points: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]], into_ring_is_exit: true }
const SECOND: CountingRing = { points: [[0.6, 0.6], [0.8, 0.6], [0.7, 0.8]], into_ring_is_exit: false }

describe('ringsOfCamera', () => {
  it('đọc counting_rings; bản ghi cũ chỉ có counting_ring thì là 1 vòng', () => {
    expect(ringsOfCamera({ counting_rings: [RING, SECOND], counting_ring: RING })).toEqual([RING, SECOND])
    expect(ringsOfCamera({ counting_ring: RING })).toEqual([RING])
  })

  it('đã xoá vòng hoặc chưa vẽ thì không có vòng nào (camera dùng vòng mặc định)', () => {
    expect(ringsOfCamera({ counting_rings: [] })).toEqual([])
    expect(ringsOfCamera({})).toEqual([])
  })
})

describe('shownRings', () => {
  it('chưa vẽ thì hiện vòng mặc định nút AI báo; đã vẽ thì hiện vòng đã vẽ', () => {
    expect(shownRings({ counting_rings: [], default_rings: [SECOND] })).toEqual({ rings: [SECOND], isDefault: true })
    expect(shownRings({ counting_rings: [RING], default_rings: [SECOND] })).toEqual({ rings: [RING], isDefault: false })
    expect(shownRings({})).toEqual({ rings: [], isDefault: true })
  })
})

describe('ringList', () => {
  it('lịch sử cũ ghi 1 vòng, lịch sử mới ghi danh sách; null là chưa có vòng', () => {
    expect(ringList(RING)).toEqual([RING])
    expect(ringList([RING, SECOND])).toEqual([RING, SECOND])
    expect(ringList(null)).toEqual([])
    expect(ringList({ unrelated: 1 })).toEqual([])
  })
})

describe('placePoint', () => {
  const tap = (state: { rings: CountingRing[]; activeIndex: number }, extending = false) =>
    placePoint(state.rings, state.activeIndex, [0.5, 0.5], extending, true)

  it('đủ 4 đỉnh thì chạm tiếp sang vòng mới, cùng chiều đếm', () => {
    let state = { rings: [] as CountingRing[], activeIndex: 0 }
    for (let i = 0; i < 5; i++) state = tap(state)
    expect(state.rings.map(ring => ring.points.length)).toEqual([4, 1])
    expect(state.activeIndex).toBe(1)
    expect(state.rings[1].into_ring_is_exit).toBe(true)
  })

  it('chọn lại một vòng thì thêm đỉnh được tới 12', () => {
    let state = { rings: [{ ...RING, points: Array(4).fill([0.1, 0.1]) }], activeIndex: 0 }
    for (let i = 0; i < 10; i++) state = tap(state, true)
    expect(state.rings.map(ring => ring.points.length)).toEqual([12, 2])
  })

  it('đủ 4 vòng thì không mở thêm', () => {
    const full = Array(4).fill({ ...RING, points: Array(4).fill([0.1, 0.1]) })
    expect(tap({ rings: full, activeIndex: 3 }).rings).toHaveLength(4)
  })
})

describe('removeRing', () => {
  it('bỏ vòng 2 thì chạm tiếp mở vòng mới, không kéo dài vòng 1', () => {
    const four = { ...RING, points: Array(4).fill([0.1, 0.1]) }
    const removed = removeRing([four, SECOND], 1)
    expect(removed).toEqual({ rings: [four], activeIndex: 0 })
    const next = placePoint(removed.rings, removed.activeIndex, [0.5, 0.5], false, true)
    expect(next.rings.map(ring => ring.points.length)).toEqual([4, 1])
  })
})
