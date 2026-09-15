import express, { Application, Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { rateLimiter } from '@/middlewares/rateLimiter'
import { errorHandler } from '@/middlewares/errorHandler'

import authRoutes      from '@/routes/auth'
import farmRoutes      from '@/routes/farms'
import deviceRoutes    from '@/routes/devices'
import telemetryRoutes from '@/routes/telemetry'
import alertRoutes     from '@/routes/alerts'
import analyticsRoutes from '@/routes/analytics'
import harvestRoutes        from '@/routes/harvests'
import marketplaceRoutes    from '@/routes/marketplace'
import ticketRoutes         from '@/routes/tickets'
import productRoutes        from '@/routes/products'
import inventoryRoutes      from '@/routes/inventory'
import orderRoutes          from '@/routes/orders'
import returnRequestRoutes  from '@/routes/returnRequests'
import salesReportsRoutes   from '@/routes/salesReports'

const app: Application = express()

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(rateLimiter)

// ── Logging & Parsing ──────────────────────────────────────────────────────────
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes)
app.use('/farms',     farmRoutes)
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
