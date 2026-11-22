// độ khớp hệ thống (snapshot lúc chấm) với người chấm, GOOD < WATCH < ACTION
export const ORDERED_STATUSES = ['GOOD', 'WATCH', 'ACTION'] as const
export type OrderedStatus = typeof ORDERED_STATUSES[number]

export interface RatingPair { system: OrderedStatus; rater: OrderedStatus }

const Z95 = 1.96
const K = ORDERED_STATUSES.length

// Hàng = hệ thống, cột = người chấm
export function confusionMatrix(pairs: RatingPair[]): number[][] {
  const m = ORDERED_STATUSES.map(() => ORDERED_STATUSES.map(() => 0))
  for (const p of pairs) m[ORDERED_STATUSES.indexOf(p.system)][ORDERED_STATUSES.indexOf(p.rater)]++
  return m
}

// Wilson 95 %: đúng hơn Wald khi n nhỏ hoặc tỷ lệ gần 0, 1
export function agreementWithCI(pairs: RatingPair[]): { value: number; ci_low: number; ci_high: number } | null {
  const n = pairs.length
  if (n === 0) return null
  const p = pairs.filter(x => x.system === x.rater).length / n
  const z2 = Z95 * Z95
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const half = (Z95 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom
  return { value: p, ci_low: Math.max(0, center - half), ci_high: Math.min(1, center + half) }
}

// w = 1 − |i − j| / (K − 1). null khi kỳ vọng ngẫu nhiên = 1
export function linearWeightedKappa(pairs: RatingPair[]): number | null {
  const n = pairs.length
  if (n === 0) return null
  const m = confusionMatrix(pairs)
  const rows = m.map(r => r.reduce((a, b) => a + b, 0))
  const cols = ORDERED_STATUSES.map((_, j) => m.reduce((a, r) => a + r[j], 0))
  let po = 0
  let pe = 0
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const w = 1 - Math.abs(i - j) / (K - 1)
      po += (w * m[i][j]) / n
      pe += (w * rows[i] * cols[j]) / (n * n)
    }
  }
  return pe === 1 ? null : (po - pe) / (1 - pe)
}

// Ít bị kéo thấp hơn kappa khi phần lớn ngày cùng 1 mức
export function gwetAC1(pairs: RatingPair[]): number | null {
  const n = pairs.length
  if (n === 0) return null
  const m = confusionMatrix(pairs)
  const pa = ORDERED_STATUSES.reduce((a, _, i) => a + m[i][i], 0) / n
  let sum = 0
  for (let q = 0; q < K; q++) {
    const pi = (m[q].reduce((a, b) => a + b, 0) + m.reduce((a, r) => a + r[q], 0)) / (2 * n)
    sum += pi * (1 - pi)
  }
  const pe = sum / (K - 1)
  return pe === 1 ? null : (pa - pe) / (1 - pe)
}

// Trong những lần người chấm cho GOOD, phần hệ thống báo khác GOOD. null khi chưa có lần nào
export function falseAlarmRate(pairs: { predicted: OrderedStatus; rater: OrderedStatus }[]): number | null {
  const good = pairs.filter(p => p.rater === 'GOOD')
  return good.length ? good.filter(p => p.predicted !== 'GOOD').length / good.length : null
}
