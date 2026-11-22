import 'dotenv/config'
import { createServer } from 'http'
import app              from './config/app.config'
import { connectDB }    from './config/db.config'
import { initSocket }   from './socket'
import { connectMQTT }  from './mqtt/mqtt.client'
import { startWeatherCompensationJob } from './jobs/weatherCompensation.job'
import { startRecommendationEffectJob } from './jobs/recommendationEffect.job'
import { startDeviceOfflineJob } from './jobs/deviceOffline.job'
import { startAlertEscalationJob } from './jobs/alertEscalation.job'
import { startRecoveryCheckJob } from './jobs/recoveryCheck.job'
import { startMaintenanceDueJob } from './jobs/maintenanceDue.job'
import { startOverrideExpiryJob } from './jobs/overrideExpiry.job'
import { startInvitationExpiryJob } from './jobs/invitationExpiry.job'
import { startActivationOverdueJob } from './jobs/activationOverdue.job'
import { startRelayUsageJob } from './jobs/relayUsage.job'
import { startSensorAnomalyJob } from './jobs/sensorAnomaly.job'
import { startForecastJob } from './jobs/forecast.job'
import { startHouseHealthReportJob } from './jobs/houseHealthReport.job'
import { startReturnRateJob } from './jobs/returnRate.job'
import { startCameraConfigJob } from './jobs/cameraConfig.job'
import { startDeletionRequestReminderJob } from './jobs/deletionRequestReminder.job'
import { startWeatherJob } from './jobs/weather.job'
import { startConfigSyncJob } from './jobs/configSync.job'
import { startTelegramPolling } from './services/telegram.service'
import logger           from './utils/logger.util'

const PORT = Number(process.env.PORT ?? 3000)

async function bootstrap(): Promise<void> {
  await connectDB()

  const httpServer = createServer(app)

  initSocket(httpServer)

  connectMQTT()

  startWeatherCompensationJob()
  startRecommendationEffectJob()
  startDeviceOfflineJob()
  startAlertEscalationJob()
  startRecoveryCheckJob()
  startMaintenanceDueJob()
  startOverrideExpiryJob()
  startInvitationExpiryJob()
  startActivationOverdueJob()
  startRelayUsageJob()
  startSensorAnomalyJob()
  startForecastJob()
  startHouseHealthReportJob()
  startReturnRateJob()
  startCameraConfigJob()
  startDeletionRequestReminderJob()
  startWeatherJob()
  startConfigSyncJob()
  // Chỉ chạy khi có TELEGRAM_BOT_TOKEN
  startTelegramPolling()

  httpServer.listen(PORT, () => {
    logger.info(`SwiftletCare API running on port ${PORT} [${process.env.NODE_ENV}]`)
  })

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...')
    httpServer.close(() => process.exit(0))
  })
}

bootstrap().catch((err: Error) => {
  logger.error('Bootstrap failed', { err })
  process.exit(1)
})
