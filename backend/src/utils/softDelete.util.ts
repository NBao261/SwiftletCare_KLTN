import type { Query, Schema } from 'mongoose'

/**
 * Ẩn document đã xoá mềm (`is_deleted: true`) khỏi MỌI truy vấn theo filter — find*,
 * findOneAndUpdate/findByIdAndUpdate, countDocuments, distinct. Trước đây chỉ hook find/findOne
 * nên findByIdAndUpdate vẫn thêm được thành viên vào farm đã xoá. Caller tự ghi
 * `is_deleted` trong filter (script, màn Admin cần xem bản đã xoá) thì giữ nguyên.
 */
export function applySoftDeleteScope(schema: Schema): void {
  function scope(this: Query<unknown, unknown>) {
    // `$ne: true`, không phải `false`: bản ghi tạo trước khi model có trường (nhà, Zone trước G-32) không có `is_deleted`
    if (this.getFilter().is_deleted === undefined) this.where({ is_deleted: { $ne: true } })
  }
  schema.pre(/^find/, scope)
  schema.pre('countDocuments', scope)
  // `Model.find(filter).distinct()` đổi thao tác sang distinct nên không qua hook find
  schema.pre('distinct', scope)
}
