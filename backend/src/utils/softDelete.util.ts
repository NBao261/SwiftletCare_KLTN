import type { Query, Schema } from 'mongoose'

/** Cả findOneAndUpdate, countDocuments, distinct. Filter tự ghi is_deleted thì giữ nguyên */
export function applySoftDeleteScope(schema: Schema): void {
  function scope(this: Query<unknown, unknown>) {
    // $ne: true vì bản ghi cũ không có is_deleted
    if (this.getFilter().is_deleted === undefined) this.where({ is_deleted: { $ne: true } })
  }
  schema.pre(/^find/, scope)
  schema.pre('countDocuments', scope)
  // find(filter).distinct() không qua hook find
  schema.pre('distinct', scope)
}
