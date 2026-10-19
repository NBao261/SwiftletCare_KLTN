/**
 * migrate-regions.ts — đưa `farms.region` và `users.assigned_regions` về mã danh mục 34
 * tỉnh/thành (utils/regions.util). Trước đây region là chuỗi gõ tay ("HCMC", "TP. Hồ Chí
 * Minh", "Long An"...) và so khớp tuyệt đối, nên farm và Technician cùng một nơi vẫn có
 * thể không khớp nhau.
 *
 * Chạy: npm run migrate:regions   (chạy lại nhiều lần vẫn an toàn)
 *
 * - Nhận ra được (mã, tên, viết tắt, tên tỉnh cũ đã sáp nhập) → đổi sang mã.
 * - Không nhận ra → GIỮ NGUYÊN và in danh sách để Admin sửa tay (PUT /farms/:id,
 *   PUT /admin/technicians/:id/regions); không tự xoá để khỏi mất thông tin.
 * - Farm chưa có region → in danh sách (không Technician nào phụ trách được farm đó).
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { REGION_CODES, toRegionCode } from '@/utils/regions.util'
import logger from '@/utils/logger.util'

export async function migrateRegions() {
  // Thẳng trên collection: không qua hook/validate của model
  const db = mongoose.connection.db!
  const unmatchedFarms: string[] = []
  const missingRegionFarms: string[] = []
  let farmsUpdated = 0

  for (const farm of await db.collection('farms').find({ is_deleted: { $ne: true } }, { projection: { name: 1, region: 1 } }).toArray()) {
    const region = farm.region as string | undefined
    if (!region?.trim()) {
      missingRegionFarms.push(`${farm.name as string} (${String(farm._id)})`)
      continue
    }
    if (REGION_CODES.has(region)) continue
    const code = toRegionCode(region)
    if (!code) {
      unmatchedFarms.push(`${farm.name as string} (${String(farm._id)}): "${region}"`)
      continue
    }
    await db.collection('farms').updateOne({ _id: farm._id }, { $set: { region: code } })
    farmsUpdated += 1
  }

  const unmatchedTechnicians: string[] = []
  let techniciansUpdated = 0
  for (const user of await db.collection('users').find({ role: 'TECHNICIAN' }, { projection: { email: 1, assigned_regions: 1 } }).toArray()) {
    const before = (user.assigned_regions as string[] | undefined) ?? []
    const unknown = before.filter(r => !toRegionCode(r))
    if (unknown.length) unmatchedTechnicians.push(`${user.email as string}: ${unknown.map(r => `"${r}"`).join(', ')}`)
    const after = [...new Set(before.map(r => toRegionCode(r) ?? r))]
    if (after.length === before.length && after.every((r, i) => r === before[i])) continue
    await db.collection('users').updateOne({ _id: user._id }, { $set: { assigned_regions: after } })
    techniciansUpdated += 1
  }

  logger.info(`[migrate] Region → mã danh mục: ${farmsUpdated} farm, ${techniciansUpdated} Technician`)
  if (unmatchedFarms.length) logger.warn(`[migrate] Farm có khu vực không nhận ra, sửa tay: ${unmatchedFarms.join('; ')}`)
  if (unmatchedTechnicians.length) logger.warn(`[migrate] Technician có khu vực không nhận ra, sửa tay: ${unmatchedTechnicians.join('; ')}`)
  if (missingRegionFarms.length) logger.warn(`[migrate] Farm chưa có khu vực (không ai phụ trách được): ${missingRegionFarms.join('; ')}`)

  return { farmsUpdated, techniciansUpdated, unmatchedFarms, unmatchedTechnicians, missingRegionFarms }
}

if (require.main === module) {
  connectDB()
    .then(migrateRegions)
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
