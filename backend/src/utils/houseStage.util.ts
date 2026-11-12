import type { HouseStage } from '@/types'

/** FARM-FR-014 — một lần đổi giai đoạn nhà, ghi vào `houses.stage_history` */
export interface StageChange { stage: HouseStage; changed_at: Date }

export const HOUSE_STAGES: readonly HouseStage[] = ['ATTRACTING', 'OCCUPIED']
/** Nhà chưa từng đặt giai đoạn là nhà đã có chim ở (OCCUPIED): giữ cách đánh giá trước BR-46 */
export const DEFAULT_HOUSE_STAGE: HouseStage = 'OCCUPIED'

/** Việt Nam UTC+7 cố định: ngày 'YYYY-MM-DD' theo giờ VN của một thời điểm */
const vnDateOf = (at: Date): string => new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

/**
 * BR-46 — giai đoạn của nhà trong ngày `date` (giờ VN): lần đổi cuối cùng trước hết ngày đó. Tính theo lịch sử
 * để việc tính lại một ngày cũ (dữ liệu trễ, SM-17) dùng đúng giai đoạn lúc ấy, không phải giai đoạn hiện tại.
 */
export function stageOn(history: StageChange[] | undefined, date: string): HouseStage {
  let stage = DEFAULT_HOUSE_STAGE
  for (const change of history ?? []) {
    if (vnDateOf(change.changed_at) <= date) stage = change.stage
  }
  return stage
}

/**
 * BR-46, BR-21 — chuyển sang OCCUPIED thì cửa sổ so sánh tỷ lệ chim về bắt đầu từ ngày đủ phiên kế tiếp: trả
 * ngày của lần chuyển gần nhất (các ngày nền phải sau ngày này), hoặc null khi nhà chưa từng qua ATTRACTING.
 */
export function baselineAfter(history: StageChange[] | undefined, date: string): string | null {
  let after: string | null = null
  for (const change of history ?? []) {
    const day = vnDateOf(change.changed_at)
    if (day <= date && change.stage === 'OCCUPIED') after = day
  }
  return after
}
