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
 */
export function paginate(
  page: number | string | undefined,
  limit: number | string | undefined,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; skip: number; limit: number } {
  const { defaultLimit = 20, maxLimit = 100 } = opts
  const p = Math.max(1, Number(page ?? 1))
  const l = Math.min(maxLimit, Number(limit ?? defaultLimit))
  return { page: p, skip: (p - 1) * l, limit: l }
}
