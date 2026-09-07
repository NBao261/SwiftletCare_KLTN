/**
 * SwiftletCare Backend – Entry Point
 * SRS: §7.4 — Node.js 20 LTS, Express 4.x
 */

import 'dotenv/config'
import { createServer } from 'http'
import app              from './config/app'
import { connectDB }    from './config/db'
import { initSocket }   from './socket'
import { connectMQTT }  from './mqtt/client'
import logger           from './utils/logger'

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
