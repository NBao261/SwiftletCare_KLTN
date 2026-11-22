import { describe, expect, it } from 'vitest'
import { ringList, ringsOfCamera } from '@/components/common/countingRing.utils'
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

describe('ringList', () => {
  it('lịch sử cũ ghi 1 vòng, lịch sử mới ghi danh sách; null là chưa có vòng', () => {
    expect(ringList(RING)).toEqual([RING])
    expect(ringList([RING, SECOND])).toEqual([RING, SECOND])
    expect(ringList(null)).toEqual([])
    expect(ringList({ unrelated: 1 })).toEqual([])
  })
})
