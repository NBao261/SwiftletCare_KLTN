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

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' })
})

// ── Error Handler (must be last, 4-arg signature) ─────────────────────────────
app.use(errorHandler)

export default app
