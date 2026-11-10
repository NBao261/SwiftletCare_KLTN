/**
 * Cấp mật khẩu broker cho thiết bị đã có trong kho (nhập trước G-07, hoặc màn Admin chưa có nút):
 *   npm run device:broker-secret -- <deviceId>
 * In mật khẩu đúng 1 lần để flash bằng firmware/tools/flash_identity.py.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { ProvisionedDevice } from '@/models/provisionedDevice.model'
import { rotateBrokerSecret } from '@/services/provisionedDevice.service'

async function main() {
  const deviceId = process.argv[2]
  if (!deviceId) throw new Error('Cách dùng: npm run device:broker-secret -- <deviceId>')
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/swiftletcare')
  const device = await ProvisionedDevice.findOne({ device_id: deviceId }).select('_id').lean()
  if (!device) throw new Error(`Không có "${deviceId}" trong kho thiết bị`)
  const { broker_secret } = await rotateBrokerSecret(undefined, String(device._id))
  console.log(`${deviceId}: ${broker_secret}`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error((err as Error).message)
  process.exit(1)
})
