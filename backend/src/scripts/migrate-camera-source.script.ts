// rtsp_url cũ lưu không mã hoá của camera → camera_source mã hoá (cần CAMERA_SOURCE_KEY), rồi xoá trường cũ. Chạy lại an toàn
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { migrateLegacyRtspUrls } from '@/services/cameraSource.service'
import logger from '@/utils/logger.util'

if (require.main === module) {
  connectDB()
    .then(migrateLegacyRtspUrls)
    .then(({ moved, skipped }) => logger.info(`[migrate] camera-source: chuyển ${moved}, bỏ qua ${skipped}`))
    .then(() => mongoose.disconnect())
    .catch((err: Error) => {
      logger.error('[migrate] Failed', { err })
      process.exit(1)
    })
}
