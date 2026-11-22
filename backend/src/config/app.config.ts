import express, { Application, Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { isInternalRequest } from '@/utils/requestLog.util'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yaml'
import fs from 'fs'
import path from 'path'
import { apiLimiter } from '@/middlewares/rateLimiter.middleware'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import logger from '@/utils/logger.util'
import { parseTrustProxy } from '@/utils/trustProxy.util'
import { isLocalStorage, localStorageDir } from '@/config/minio.config'

import authRoutes     from '@/routes/auth.route'
import adminRoutes     from '@/routes/admin.route'
import systemRoutes    from '@/routes/system.route'
import farmRoutes      from '@/routes/farms.route'
import invitationRoutes from '@/routes/invitations.route'
import deviceRoutes    from '@/routes/devices.route'
import telemetryRoutes from '@/routes/telemetry.route'
import alertRoutes     from '@/routes/alerts.route'
import analyticsRoutes from '@/routes/analytics.route'
import harvestRoutes        from '@/routes/harvests.route'
import healthReportRoutes   from '@/routes/healthReports.route'
import expertActivityRoutes from '@/routes/expertActivity.route'
import notificationRoutes   from '@/routes/notifications.route'
import workOrderRoutes      from '@/routes/workOrders.route'
import maintenanceRoutes    from '@/routes/maintenance.route'
import profileRoutes        from '@/routes/profiles.route'
import recommendationRoutes from '@/routes/recommendations.route'
import internalRoutes from '@/routes/internal.route'

const app: Application = express()

// Sau reverse proxy đặt TRUST_PROXY=<số hop>, nếu không req.ip là IP của proxy
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY)
if (trustProxy !== false) app.set('trust proxy', trustProxy)

app.use(helmet())
// credentials: cookie refreshToken cross-origin, nên không dùng được origin '*'
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(apiLimiter)

// /internal/* mang khoá trong ?key=, không ghi vào log truy cập
app.use(morgan('combined', { skip: isInternalRequest }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(requestContext) // Phải đứng trước các router (audit log cần IP)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// STORAGE_DRIVER=local: cho <audio> ở origin khác đọc file
if (isLocalStorage()) {
  app.use('/files', express.static(localStorageDir(), {
    setHeaders: res => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }))
  logger.warn(`STORAGE_DRIVER=local — file lưu tại ${localStorageDir()}, phục vụ công khai ở /files (chỉ dùng cho dev)`)
}

try {
  const specPath = path.resolve(__dirname, '../../../docs/api/api-spec.yaml')
  const openApiSpec = YAML.parse(fs.readFileSync(specPath, 'utf-8')) as Record<string, unknown>
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))
  app.get('/api-docs.yaml', (_req: Request, res: Response) => res.sendFile(specPath))
} catch (err) {
  logger.warn('Swagger spec không load được — /api-docs sẽ không khả dụng', { err })
}

app.use('/auth',      authRoutes)
app.use('/admin',     adminRoutes)
app.use('/system',    systemRoutes)
app.use('/farms',       farmRoutes)
app.use('/invitations', invitationRoutes)
app.use('/devices',   deviceRoutes)
app.use('/telemetry', telemetryRoutes)
app.use('/alerts',    alertRoutes)
app.use('/analytics', analyticsRoutes)

app.use('/harvests',    harvestRoutes)

app.use('/health-reports', healthReportRoutes)
app.use('/expert-activity', expertActivityRoutes)
app.use('/notifications', notificationRoutes)
app.use('/work-orders', workOrderRoutes)
app.use('/maintenance', maintenanceRoutes)
app.use('/profiles', profileRoutes)
app.use('/recommendations', recommendationRoutes)

app.use('/internal', internalRoutes)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' })
})

// Phải đứng cuối
app.use(errorHandler)

export default app
