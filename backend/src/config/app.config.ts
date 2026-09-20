import express, { Application, Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yaml'
import fs from 'fs'
import path from 'path'
import { rateLimiter } from '@/middlewares/rateLimiter.middleware'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { requestContext } from '@/middlewares/requestContext.middleware'
import logger from '@/utils/logger.util'
import { parseTrustProxy } from '@/utils/trustProxy.util'

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
import marketplaceRoutes    from '@/routes/marketplace.route'
import ticketRoutes         from '@/routes/tickets.route'
import productRoutes        from '@/routes/products.route'
import inventoryRoutes      from '@/routes/inventory.route'
import orderRoutes          from '@/routes/orders.route'
import returnRequestRoutes  from '@/routes/returnRequests.route'
import salesReportsRoutes   from '@/routes/salesReports.route'

const app: Application = express()

// Sau reverse proxy/tunnel (Cloudflare, nginx) req.ip mặc định là IP của proxy —
// audit log và rate limit sẽ gom mọi client về 1 địa chỉ. Đặt TRUST_PROXY=<số hop>
// (hoặc loopback/danh sách IP proxy) khi triển khai sau proxy; bỏ trống = không tin header.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY)
if (trustProxy !== false) app.set('trust proxy', trustProxy)

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet())
// credentials:true bắt buộc để trình duyệt lưu/gửi cookie refreshToken (AUTH-FR-003)
// cross-origin (frontend :5173 -> backend :3000) — không dùng được origin '*' khi bật credentials.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(rateLimiter)

// ── Logging & Parsing ──────────────────────────────────────────────────────────
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser()) // cần cho req.cookies.refreshToken (AUTH-FR-003)
app.use(requestContext) // IP client cho audit_logs — phải đứng trước các router

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── API Docs (Swagger UI đọc trực tiếp docs/api/api-spec.yaml) ───────────────
try {
  const specPath = path.resolve(__dirname, '../../../docs/api/api-spec.yaml')
  const openApiSpec = YAML.parse(fs.readFileSync(specPath, 'utf-8')) as Record<string, unknown>
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))
  app.get('/api-docs.yaml', (_req: Request, res: Response) => res.sendFile(specPath))
} catch (err) {
  logger.warn('Swagger spec không load được — /api-docs sẽ không khả dụng', { err })
}

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes)
app.use('/admin',     adminRoutes)
app.use('/system',    systemRoutes)
app.use('/farms',       farmRoutes)
app.use('/invitations', invitationRoutes)
app.use('/devices',   deviceRoutes)
app.use('/telemetry', telemetryRoutes)
app.use('/alerts',    alertRoutes)
app.use('/analytics', analyticsRoutes)

// Module MARKET (§5.8) — thuộc phạm vi MVP (landing page + form liên hệ)
app.use('/harvests',    harvestRoutes)
app.use('/marketplace', marketplaceRoutes)

// Module TICKET (§5.9) — thuộc phạm vi MVP
app.use('/tickets', ticketRoutes)

// Module SALES (§5.10) — Giai đoạn 2, stretch (không bắt buộc nghiệm thu KLTN)
app.use('/products',        productRoutes)
app.use('/inventory',       inventoryRoutes)
app.use('/orders',          orderRoutes)
app.use('/return-requests', returnRequestRoutes)
app.use('/sales-reports',   salesReportsRoutes)

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' })
})

// ── Error Handler (must be last, 4-arg signature) ─────────────────────────────
app.use(errorHandler)

export default app
