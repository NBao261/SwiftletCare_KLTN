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

/** Paginate a Mongoose query */
export function paginate(page: string | undefined, limit: string | undefined): { skip: number; limit: number } {
  const p = Math.max(1, Number(page ?? 1))
  const l = Math.min(100, Number(limit ?? 20))
  return { skip: (p - 1) * l, limit: l }
}
