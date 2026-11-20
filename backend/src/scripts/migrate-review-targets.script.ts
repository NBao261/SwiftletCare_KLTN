/**
 * G-31 (Report 3 4.2.15) — mục duyệt có thêm nhóm theo nhà và camera: điền `target_id`, `house_id` cho mục cũ
 * (đều theo Zone), rồi đồng bộ chỉ mục (bỏ { zone_id, group }, tạo { target_id, group }).
 * Chạy: npm run migrate:review-targets   (chạy lại nhiều lần vẫn an toàn)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Zone } from '@/models/houseZone.model'
import { ParameterReview } from '@/models/parameterReview.model'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/swiftletcare')
  const old = await ParameterReview.find({ target_id: { $exists: false } }).select('zone_id').lean()
  const houseByZone = new Map(
    (await Zone.find({ _id: { $in: old.map(r => r.zone_id) } }).select('house_id').lean()).map(z => [String(z._id), z.house_id]),
  )
  for (const review of old) {
    await ParameterReview.updateOne(
      { _id: review._id },
      { target_id: review.zone_id, house_id: houseByZone.get(String(review.zone_id)) },
    )
  }
  await ParameterReview.syncIndexes()
  console.log(`Đã điền đối tượng cho ${old.length} mục duyệt và đồng bộ chỉ mục`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
