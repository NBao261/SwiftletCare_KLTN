/**
 * SwiftletCare Backend – Shared TypeScript Types
 * Mirror of frontend types/index.ts but with Mongoose Document extensions
 */

import { Request } from 'express'
import { Document, Types } from 'mongoose'

// ── Domain Enums ───────────────────────────────────────────────────────────────
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'OPERATOR'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
export type SessionType  = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode  = 'AUTO' | 'MANUAL'

// ── JWT Payload ────────────────────────────────────────────────────────────────
export interface JwtAccessPayload {
  sub: string   // User._id
  role: Role
  iat: number
  exp: number
}

// ── Authenticated Express Request ──────────────────────────────────────────────
export interface AuthRequest extends Request {
  user: {
    _id: string
    email: string
    role: Role
    full_name: string
    is_active: boolean
    notification_preferences: NotificationPreferences
  }
}

// ── Sub-document interfaces ────────────────────────────────────────────────────
export interface NotificationPreferences {
  push: boolean
  zalo: boolean
  sms: boolean
  quiet_hours: { start: string; end: string }
}

export interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  co2_max: number
}

export interface RelayStates {
  misting: boolean
  ventilation: boolean
  heating: boolean
  light: boolean
}

// ── MQTT Message Payloads ──────────────────────────────────────────────────────
export interface TelemetryPayload {
  deviceId: string
  temperature: number
  humidity: number
  light_lux: number
  co2_ppm: number
  sound_db: number
  temp_outdoor?: number
  humid_outdoor?: number
  relay_states: RelayStates
  control_mode: ControlMode
  timestamp: number   // Unix ms
}

export interface HeartbeatPayload {
  deviceId: string
  firmwareVersion: string
  rssi: number
  freeHeap: number
  uptime: number
  timestamp: number
}

export interface RelayStatusPayload {
  deviceId: string
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: number
}

export interface BirdCountPayload {
  deviceId: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  return_rate: number
  confidence_avg: number
  timestamp: number
}

export interface VisionAlertPayload {
  deviceId: string
  type: 'PREDATOR_DETECTED'
  class: 'rat' | 'snake' | 'owl'
  severity: AlertSeverity
  confidence: number
  snapshotUrl?: string
  timestamp: number
}

// ── WebSocket Event Payloads (§9.3) ───────────────────────────────────────────
export interface WsTelemetryUpdate {
  zoneId: string
  temperature: number
  humidity: number
  light: number
  co2: number
  sound: number
  relayStates: RelayStates
  controlMode: ControlMode
  timestamp: string
}

export interface WsRelayUpdate {
  zoneId: string
  relayName: keyof RelayStates
  state: boolean
  mode: ControlMode
  overrideExpiry?: string
}

export interface WsBirdCountUpdate {
  zoneId: string
  entryCount: number
  exitCount: number
  returnRate: number
  sessionType: SessionType
  timestamp: string
}

export interface WsAlertNew {
  alertId: string
  severity: AlertSeverity
  type: AlertType
  title: string
  message: string
  snapshotUrl?: string
}

// ── API Response Wrappers ──────────────────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export interface ApiError {
  error: string
  details?: string | Record<string, unknown>
  code?: string
}

// ── Pagination Query Params ────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: string
  limit?: string
}
