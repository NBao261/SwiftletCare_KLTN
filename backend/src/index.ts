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
import { startActivationOverdueJob } from './jobs/activationOverdue.job'
import { startRelayUsageJob } from './jobs/relayUsage.job'
import { startSensorAnomalyJob } from './jobs/sensorAnomaly.job'
import { startForecastJob } from './jobs/forecast.job'
import { startHealthReportJob } from './jobs/healthReport.job'
import { startReturnRateJob } from './jobs/returnRate.job'
import { startDeletionRequestReminderJob } from './jobs/deletionRequestReminder.job'
import { startTelegramPolling } from './services/telegram.service'
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

  // 4b. Các job nền: phát hiện offline (FARM-FR-005), gửi lại cảnh báo
  // chưa xác nhận (ALERT-FR-015), hết hạn Manual Override (ENV-FR-018)
  startDeviceOfflineJob()
  startAlertEscalationJob()
  startOverrideExpiryJob()
  startInvitationExpiryJob()
  startActivationOverdueJob()
  startRelayUsageJob()
  startSensorAnomalyJob()
  startForecastJob()
  startHealthReportJob()
  startReturnRateJob()
  startDeletionRequestReminderJob()
  // ALERT-FR-013 — nhận `/start <mã>` của bot Telegram (chỉ chạy khi có TELEGRAM_BOT_TOKEN)
  startTelegramPolling()

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
