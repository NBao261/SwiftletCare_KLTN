import type { Query, Schema } from 'mongoose'

/**
 * Ẩn document đã xoá mềm (`is_deleted: true`) khỏi MỌI truy vấn theo filter — find*,
 * findOneAndUpdate/findByIdAndUpdate, countDocuments. Trước đây chỉ hook find/findOne
 * nên findByIdAndUpdate vẫn thêm được thành viên vào farm đã xoá. Caller tự ghi
 * `is_deleted` trong filter (script, màn Admin cần xem bản đã xoá) thì giữ nguyên.
 */
export function applySoftDeleteScope(schema: Schema): void {
  function scope(this: Query<unknown, unknown>) {
    if (this.getFilter().is_deleted === undefined) this.where({ is_deleted: false })
  }
  schema.pre(/^find/, scope)
  schema.pre('countDocuments', scope)
}
