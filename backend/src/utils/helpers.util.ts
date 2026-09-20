import { Types } from 'mongoose'

/** Validate MongoDB ObjectId string */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

/** Safe JSON parse – returns null on failure */
export function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

/**
 * Paginate a Mongoose query — trả cả `page` đã chuẩn hoá (không chỉ skip/limit)
 * để service dùng thẳng cho response `meta`, khỏi tính `page` riêng ở nơi gọi.
 * Giá trị không hợp lệ (NaN, ≤ 0, không phải số) rơi về mặc định thay vì lọt
 * xuống Mongo — `skip` âm hoặc `limit(NaN)` làm request nổ 500, `limit(0)`
 * lại nghĩa là "không giới hạn".
 */
export function paginate(
  page: number | string | undefined,
  limit: number | string | undefined,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; skip: number; limit: number } {
  const { defaultLimit = 20, maxLimit = 100 } = opts
  const rawPage = Number(page)
  const rawLimit = Number(limit)
  const p = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const l = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(maxLimit, Math.floor(rawLimit)) : defaultLimit
  return { page: p, skip: (p - 1) * l, limit: l }
}
