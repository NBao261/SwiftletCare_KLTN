// Địa chỉ backend — route không có tiền tố, theo docs/api/api-spec.yaml
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
export const WEBSOCKET_BASE_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:3000'
// Gốc HLS của MediaMTX — video không đi qua backend (Report 4 D8)
export const STREAM_BASE_URL = process.env.EXPO_PUBLIC_STREAM_URL ?? 'http://localhost:8888'

// Mọi đường dẫn API của app — không viết URL cứng trong hook hay màn hình
export const ENDPOINTS = {
  // Xác thực (AUTH-FR-*)
  AUTH_LOGIN: '/auth/login',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_CHANGE_PASSWORD: '/auth/password',
  AUTH_NOTIFICATION_PREFERENCES: '/auth/notification-preferences',
  AUTH_TELEGRAM_LINK: '/auth/telegram/link',
  // Yêu cầu xoá tài khoản và dữ liệu cá nhân (AUTH-FR-012)
  AUTH_DELETE_REQUEST: '/auth/delete-request',

  // Trang trại (FARM-FR-*)
  FARMS: '/farms',
  FARM_DETAIL: (farmId: string) => `/farms/${farmId}`,
  FARM_HOUSES: (farmId: string) => `/farms/${farmId}/houses`,
  // Mời và gỡ thành viên farm — chỉ Primary Owner (AUTH-FR-005, EXPERT-FR-001)
  FARM_MEMBERS: (farmId: string) => `/farms/${farmId}/members`,
  FARM_MEMBER: (farmId: string, userId: string) => `/farms/${farmId}/members/${userId}`,
  HOUSE_ZONES: (houseId: string) => `/farms/houses/${houseId}/zones`,
  ZONE_THRESHOLDS: (zoneId: string) => `/farms/zones/${zoneId}/thresholds`,
  ZONE_THRESHOLDS_RESET: (zoneId: string) => `/farms/zones/${zoneId}/thresholds/reset`,
  ZONE_FUZZY_TUNING: (zoneId: string) => `/farms/zones/${zoneId}/fuzzy-tuning`,
  // Áp gợi ý hệ số hiện tại do server tính (EXPERT-FR-011): chuyên gia; chủ trại khi farm chưa có chuyên gia (BR-22)
  ZONE_APPLY_SUGGESTION: (zoneId: string) => `/farms/zones/${zoneId}/fuzzy-tuning/apply-suggestion`,
  ZONE_DETECTION_TUNING: (zoneId: string) => `/farms/zones/${zoneId}/detection-tuning`,
  HOUSE_BIRD_COUNT_TUNING: (houseId: string) => `/farms/houses/${houseId}/bird-count-tuning`,

  // Thiết bị
  SENSOR_NODES: '/devices/sensor-nodes',
  CAMERA_NODES: '/devices/camera-nodes',
  SENSOR_NODE_REGISTER: '/devices/sensor-nodes/register',
  CAMERA_NODE_REGISTER: '/devices/camera-nodes/register',
  RELAY_CONTROL: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay`,
  RELAY_OVERRIDE: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay-override`,
  RELAY_OVERRIDES: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay-overrides`,
  CAMERA_STREAM_TOKEN: (cameraId: string) => `/devices/camera-nodes/${cameraId}/stream-token`,

  // Dữ liệu cảm biến (ENV-FR-*)
  TELEMETRY_LATEST: (zoneId: string) => `/telemetry/zones/${zoneId}/latest`,

  // Cảnh báo (ALERT-FR-*)
  ALERTS: '/alerts',
  ALERT_DETAIL: (alertId: string) => `/alerts/${alertId}`,
  ALERT_ACKNOWLEDGE: (alertId: string) => `/alerts/${alertId}/acknowledge`,
  ALERT_VERDICT: (alertId: string) => `/alerts/${alertId}/verdict`,
  // Bằng chứng ±30 phút của cảnh báo suy luận (ALERT-FR-014)
  ALERT_EVIDENCE: (alertId: string) => `/alerts/${alertId}/evidence`,

  // Hoạt động chuyên gia (EXPERT-FR-009/010/011)
  EXPERT_ACTIVITY: '/expert-activity',
  EXPERT_REVIEWS: '/expert-activity/reviews',
  EXPERT_REVIEW_ITEM_ACTION: (itemId: string) => `/expert-activity/reviews/${itemId}`,
  EXPERT_REVIEW_ACCEPT: (itemId: string) => `/expert-activity/reviews/${itemId}/accept`,
  EXPERT_REVIEW_REVERT: (itemId: string) => `/expert-activity/reviews/${itemId}/revert`,
  EXPERT_PROPOSALS: '/expert-activity/proposals',
  EXPERT_PROPOSAL_ACTION: (proposalId: string) => `/expert-activity/proposals/${proposalId}`,
  EXPERT_PROPOSAL_APPROVE: (proposalId: string) => `/expert-activity/proposals/${proposalId}/approve`,
  EXPERT_PROPOSAL_REJECT: (proposalId: string) => `/expert-activity/proposals/${proposalId}/reject`,

  // Phân tích (ANALYTICS-FR-*)
  BIRD_COUNT_DAILY: '/analytics/bird-count/daily',
  BIRD_COUNT_TRENDS: '/analytics/bird-count/trends',
  BIRD_COUNT_CURRENT: '/analytics/bird-count/current',
  BIRD_COUNT_BUCKETS: '/analytics/bird-count/buckets',
  ENV_SUMMARY: '/analytics/env/summary',
  CONTROL_PERFORMANCE: '/analytics/control/performance',
  CONTROL_SUGGESTION: '/analytics/control/suggestion',
  AUTONOMY: '/analytics/autonomy',
  FORECAST: '/analytics/forecast',
  ENVIRONMENT_CORRELATION: '/analytics/correlation',

  // Thông báo trong ứng dụng (EXPERT-FR-006/007)
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (notificationId: string) => `/notifications/${notificationId}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',

  // Báo cáo sức khoẻ (EXPERT-FR-005/006/013)
  HEALTH_REPORTS: '/health-reports',
  HEALTH_REPORT_PREVIEW: '/health-reports/preview',
  HEALTH_REPORT_DETAIL: (reportId: string) => `/health-reports/${reportId}`,
  HEALTH_REPORT_CONCLUSION: (reportId: string) => `/health-reports/${reportId}/conclusion`,
  HEALTH_REPORT_PDF: (reportId: string) => `/health-reports/${reportId}/pdf`,
  HEALTH_REPORT_DAILY_CSV: '/health-reports/daily-csv',

  // Thu hoạch (HARVEST-FR-001…005) — danh sách đợt thu của farm
  HARVESTS: '/harvests',

  // Nghiệp vụ Chuyên gia bổ sung (Domain Expert: EXPERT-FR-*)
  ALERT_VERDICT_STATS: '/alerts/verdict-stats',
  ZONE_DETAIL: (zoneId: string) => `/farms/zones/${zoneId}`,
  HOUSE_DAILY_RATING: (houseId: string) => `/farms/houses/${houseId}/daily-rating`,
} as const
