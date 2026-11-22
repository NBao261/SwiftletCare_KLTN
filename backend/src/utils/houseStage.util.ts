import type { HouseStage } from '@/types'

export interface StageChange { stage: HouseStage; changed_at: Date }

export const HOUSE_STAGES: readonly HouseStage[] = ['ATTRACTING', 'OCCUPIED']
/** Giữ cách đánh giá trước BR-46 */
export const DEFAULT_HOUSE_STAGE: HouseStage = 'OCCUPIED'

/** UTC+7 cố định */
const vnDateOf = (at: Date): string => new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

/** Theo lịch sử để tính lại ngày cũ (SM-17) đúng giai đoạn lúc ấy */
export function stageOn(history: StageChange[] | undefined, date: string): HouseStage {
  let stage = DEFAULT_HOUSE_STAGE
  for (const change of history ?? []) {
    if (vnDateOf(change.changed_at) <= date) stage = change.stage
  }
  return stage
}

/** Ngày nền phải sau lần chuyển sang OCCUPIED; null khi chưa từng ATTRACTING */
export function baselineAfter(history: StageChange[] | undefined, date: string): string | null {
  let after: string | null = null
  for (const change of history ?? []) {
    const day = vnDateOf(change.changed_at)
    if (day <= date && change.stage === 'OCCUPIED') after = day
  }
  return after
}
