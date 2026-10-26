/** API and WebSocket endpoint constants */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
export const WS_BASE_URL  = process.env.EXPO_PUBLIC_WS_URL  ?? 'ws://localhost:3000'

export const ENDPOINTS = {
  // Auth (AUTH-FR-*)
  AUTH_LOGIN:    '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH:  '/auth/refresh',
  AUTH_LOGOUT:   '/auth/logout',
  AUTH_OTP_SEND: '/auth/otp/send',
  AUTH_OTP_VERIFY:'/auth/otp/verify',
  // Farms (FARM-FR-*)
  FARMS:         '/farms',
  FARM_HOUSES:   (farmId: string) => `/farms/${farmId}/houses`,
  HOUSE_ZONES:   (houseId: string) => `/farms/houses/${houseId}/zones`,
  ZONE_THRESHOLDS:(zoneId: string) => `/farms/zones/${zoneId}/thresholds`,
  // Devices
  SENSOR_NODES:  '/devices/sensor-nodes',
  CAMERA_NODES:  '/devices/camera-nodes',
  DEVICE_REGISTER:'/devices/sensor-nodes/register',
  RELAY_CONTROL: (id: string) => `/devices/sensor-nodes/${id}/relay`,
  // Telemetry (ENV-FR-*)
  TELEMETRY_LATEST:  (zoneId: string) => `/telemetry/zones/${zoneId}/latest`,
  TELEMETRY_HISTORY: (zoneId: string) => `/telemetry/zones/${zoneId}/history`,
  // Alerts (ALERT-FR-*)
  ALERTS:        '/alerts',
  ALERT_ACK:     (id: string) => `/alerts/${id}/acknowledge`,
  // Analytics (ANALYTICS-FR-*)
  BIRD_COUNT_DAILY:  '/analytics/bird-count/daily',
  BIRD_COUNT_TRENDS: '/analytics/bird-count/trends',
  ENV_CORRELATION:   '/analytics/correlation',
} as const
