import {
  agreementWithCI, confusionMatrix, falseAlarmRate, gwetAC1, linearWeightedKappa, type OrderedStatus, type RatingPair,
} from '@/utils/agreement.util'

/** Bảng 3×3 tính tay (hàng = hệ thống, cột = người chấm), n = 14 */
const TABLE: [OrderedStatus, OrderedStatus, number][] = [
  ['GOOD', 'GOOD', 5], ['GOOD', 'WATCH', 1],
  ['WATCH', 'GOOD', 1], ['WATCH', 'WATCH', 2], ['WATCH', 'ACTION', 1],
  ['ACTION', 'WATCH', 1], ['ACTION', 'ACTION', 3],
]
const PAIRS: RatingPair[] = TABLE.flatMap(([system, rater, n]) => Array.from({ length: n }, () => ({ system, rater })))

describe('agreement.util (ANALYTICS-FR-014)', () => {
  it('ma trận nhầm lẫn theo thứ tự GOOD < WATCH < ACTION', () => {
    expect(confusionMatrix(PAIRS)).toEqual([[5, 1, 0], [1, 2, 1], [0, 1, 3]])
  })

  it('tỷ lệ khớp 10/14 với khoảng Wilson 95 %', () => {
    const a = agreementWithCI(PAIRS)!
    expect(a.value).toBeCloseTo(10 / 14, 6)
    expect(a.ci_low).toBeCloseTo(0.4535, 3)
    expect(a.ci_high).toBeCloseTo(0.8828, 3)
  })

  it('kappa trọng số tuyến tính = 15/22 (po_w = 12/14, pe_w = 108/196)', () => {
    expect(linearWeightedKappa(PAIRS)).toBeCloseTo(15 / 22, 6)
  })

  it('AC1 của Gwet = 19/33 (pa = 10/14, pe = 0,6531/2)', () => {
    expect(gwetAC1(PAIRS)).toBeCloseTo(19 / 33, 6)
  })

  it('khớp hoàn toàn: kappa 1, AC1 1; không có dữ liệu → null', () => {
    const same: RatingPair[] = [{ system: 'GOOD', rater: 'GOOD' }, { system: 'ACTION', rater: 'ACTION' }]
    expect(linearWeightedKappa(same)).toBeCloseTo(1)
    expect(gwetAC1(same)).toBeCloseTo(1)
    expect(agreementWithCI([])).toBeNull()
    expect(linearWeightedKappa([])).toBeNull()
  })

  it('mọi ngày cùng 1 mức ở cả 2 phía: kappa không xác định (null), AC1 vẫn = 1', () => {
    const allGood: RatingPair[] = [{ system: 'GOOD', rater: 'GOOD' }, { system: 'GOOD', rater: 'GOOD' }]
    expect(linearWeightedKappa(allGood)).toBeNull()
    expect(gwetAC1(allGood)).toBeCloseTo(1)
  })

  it('báo động giả: trong các lần người chấm GOOD, phần hệ thống báo khác GOOD', () => {
    expect(falseAlarmRate(PAIRS.map(p => ({ predicted: p.system, rater: p.rater })))).toBeCloseTo(1 / 6)
    expect(falseAlarmRate([{ predicted: 'ACTION', rater: 'WATCH' }])).toBeNull()
  })
})
