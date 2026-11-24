import { Types } from 'mongoose'

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id)
}

// Không escape thì `.*` khớp mọi thứ, `(a+)+` làm Mongo quét rất lâu
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

// Giá trị sai về mặc định: skip âm, limit(NaN) nổ 500, limit(0) là không giới hạn
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
