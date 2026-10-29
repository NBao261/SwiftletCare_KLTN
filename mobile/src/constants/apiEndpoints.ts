// Địa chỉ backend — route không có tiền tố, theo docs/api/api-spec.yaml
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
export const WEBSOCKET_BASE_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:3000'

// Mọi đường dẫn API của app — không viết URL cứng trong hook hay màn hình
export const ENDPOINTS = {
  // Xác thực (AUTH-FR-*)
  AUTH_LOGIN: '/auth/login',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_CHANGE_PASSWORD: '/auth/password',
  AUTH_OTP_SEND: '/auth/otp/send',
  AUTH_OTP_VERIFY: '/auth/otp/verify',

  // Trang trại (FARM-FR-*)
  FARMS: '/farms',
  FARM_DETAIL: (farmId: string) => `/farms/${farmId}`,
  FARM_HOUSES: (farmId: string) => `/farms/${farmId}/houses`,
  HOUSE_ZONES: (houseId: string) => `/farms/houses/${houseId}/zones`,
  ZONE_THRESHOLDS: (zoneId: string) => `/farms/zones/${zoneId}/thresholds`,

  // Thiết bị
  SENSOR_NODES: '/devices/sensor-nodes',
  CAMERA_NODES: '/devices/camera-nodes',
  DEVICE_REGISTER: '/devices/sensor-nodes/register',
  RELAY_CONTROL: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay`,

  // Dữ liệu cảm biến (ENV-FR-*)
  TELEMETRY_LATEST: (zoneId: string) => `/telemetry/zones/${zoneId}/latest`,
  TELEMETRY_HISTORY: (zoneId: string) => `/telemetry/zones/${zoneId}/history`,

  // Cảnh báo (ALERT-FR-*)
  ALERTS: '/alerts',
  ALERT_DETAIL: (alertId: string) => `/alerts/${alertId}`,
  ALERT_ACKNOWLEDGE: (alertId: string) => `/alerts/${alertId}/acknowledge`,

  // Phân tích (ANALYTICS-FR-*)
  BIRD_COUNT_DAILY: '/analytics/bird-count/daily',
  BIRD_COUNT_TRENDS: '/analytics/bird-count/trends',
  ENVIRONMENT_CORRELATION: '/analytics/correlation',
} as const
