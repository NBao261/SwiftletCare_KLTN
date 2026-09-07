'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const { rateLimiter } = require('../middlewares/rateLimiter');
const { errorHandler } = require('../middlewares/errorHandler');

// Route imports
const authRoutes      = require('../routes/auth');
const farmRoutes      = require('../routes/farms');
const deviceRoutes    = require('../routes/devices');
const telemetryRoutes = require('../routes/telemetry');
const alertRoutes     = require('../routes/alerts');
const analyticsRoutes = require('../routes/analytics');

const app = express();

// ── Security Middleware (SEC-NFR-002) ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(rateLimiter);

// ── Logging & Parsing ──────────────────────────────────────────────────────────
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/auth',      authRoutes);
app.use('/farms',     farmRoutes);
app.use('/devices',   deviceRoutes);
app.use('/telemetry', telemetryRoutes);
app.use('/alerts',    alertRoutes);
app.use('/analytics', analyticsRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// ── Error Handler ──────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
