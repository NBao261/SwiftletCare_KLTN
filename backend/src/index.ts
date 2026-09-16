/**
 * SwiftletCare Backend – Entry Point
 * SRS: §7.4 — Node.js 20 LTS, Express 4.x
 */

import 'dotenv/config'
import { createServer } from 'http'
import app              from './config/app.config'
import { connectDB }    from './config/db.config'
import { initSocket }   from './socket'
import { connectMQTT }  from './mqtt/mqtt.client'
import { startDeviceOfflineJob } from './jobs/deviceOffline.job'
import { startAlertEscalationJob } from './jobs/alertEscalation.job'
import { startOverrideExpiryJob } from './jobs/overrideExpiry.job'
import { startInvitationExpiryJob } from './jobs/invitationExpiry.job'
import logger           from './utils/logger.util'

const PORT = Number(process.env.PORT ?? 3000)

async function bootstrap(): Promise<void> {
  // 1. Connect MongoDB
  await connectDB()

  // 2. Create HTTP server (needed for Socket.io)
  const httpServer = createServer(app)

  // 3. Initialize Socket.io (§9.3)
  initSocket(httpServer)

  // 4. Connect MQTT broker + start subscriptions (§9.2)
  connectMQTT()

  // 4b. Các job nền: phát hiện offline (FARM-FR-005), tự tạo ticket từ cảnh báo
  // chưa xác nhận (TICKET-FR-002), hết hạn Manual Override (ENV-FR-018)
  startDeviceOfflineJob()
  startAlertEscalationJob()
  startOverrideExpiryJob()
  startInvitationExpiryJob()

  // 5. Start HTTP server
  httpServer.listen(PORT, () => {
    logger.info(`SwiftletCare API running on port ${PORT} [${process.env.NODE_ENV}]`)
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...')
    httpServer.close(() => process.exit(0))
  })
}

bootstrap().catch((err: Error) => {
  logger.error('Bootstrap failed', { err })
  process.exit(1)
})
