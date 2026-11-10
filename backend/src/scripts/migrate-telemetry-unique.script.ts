/**
 * Dọn mẫu trùng `node_id + timestamp` (giữ bản đầu) rồi tạo unique index của ENV-FR-024.
 * Chạy: npm run migrate:telemetry-unique   (chạy lại nhiều lần vẫn an toàn)
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Telemetry } from '@/models/telemetry.model'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/swiftletcare')
  const duplicates = Telemetry.aggregate<{ ids: mongoose.Types.ObjectId[] }>([
    { $group: { _id: { node_id: '$node_id', timestamp: '$timestamp' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).allowDiskUse(true).cursor()

  let removed = 0
  for await (const { ids } of duplicates) {
    const { deletedCount } = await Telemetry.deleteMany({ _id: { $in: ids.slice(1) } })
    removed += deletedCount
  }
  await Telemetry.syncIndexes()
  console.log(`Đã xoá ${removed} mẫu trùng và tạo index`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
