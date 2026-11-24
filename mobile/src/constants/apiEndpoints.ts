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
  // Lời mời của farm (AUTH-FR-010): chỉ Primary Owner, lọc theo status (api-spec GET /farms/{id}/invitations)
  FARM_INVITATIONS: (farmId: string) => `/farms/${farmId}/invitations`,
  // Tổng quan farm (ANALYTICS-FR-015): Farm Owner, Domain Expert
  FARM_OVERVIEW: (farmId: string) => `/farms/${farmId}/overview`,
  HOUSE_ZONES: (houseId: string) => `/farms/houses/${houseId}/zones`,
  ZONE_THRESHOLDS: (zoneId: string) => `/farms/zones/${zoneId}/thresholds`,
  ZONE_THRESHOLDS_RESET: (zoneId: string) => `/farms/zones/${zoneId}/thresholds/reset`,
  ZONE_FUZZY_TUNING: (zoneId: string) => `/farms/zones/${zoneId}/fuzzy-tuning`,
  // Áp gợi ý hệ số hiện tại do server tính (EXPERT-FR-011): chuyên gia; chủ trại khi farm chưa có chuyên gia (BR-22)
  ZONE_APPLY_SUGGESTION: (zoneId: string) => `/farms/zones/${zoneId}/fuzzy-tuning/apply-suggestion`,
  ZONE_DETECTION_TUNING: (zoneId: string) => `/farms/zones/${zoneId}/detection-tuning`,
  // Về bộ mặc định của backend (EXPERT-FR-008); chủ trại trên farm có chuyên gia thì mở mục duyệt (BR-22)
  ZONE_DETECTION_TUNING_RESET: (zoneId: string) => `/farms/zones/${zoneId}/detection-tuning/reset`,
  HOUSE_BIRD_COUNT_TUNING: (houseId: string) => `/farms/houses/${houseId}/bird-count-tuning`,
  HOUSE_BIRD_COUNT_TUNING_RESET: (houseId: string) => `/farms/houses/${houseId}/bird-count-tuning/reset`,
  // Giai đoạn nhà (FARM-FR-014, BR-46): Farm Owner, Domain Expert
  HOUSE_STAGE: (houseId: string) => `/farms/houses/${houseId}/stage`,
  // Luật bù thời tiết (ENV-FR-030): chuyên gia đặt, Farm Owner đặt thẳng khi farm chưa có chuyên gia, có thì gửi đề xuất
  // (BR-22). Lịch đếm (VISION-FR-019), mức chỉ số sức khỏe (BR-28): chuyên gia và Farm Owner
  HOUSE_WEATHER_RULES: (houseId: string) => `/farms/houses/${houseId}/weather-rules`,
  HOUSE_WEATHER_RULES_PROPOSAL: (houseId: string) => `/farms/houses/${houseId}/weather-rules/proposal`,
  HOUSE_COUNTING_SCHEDULE: (houseId: string) => `/farms/houses/${houseId}/counting-schedule`,
  HOUSE_HEALTH_LEVELS: (houseId: string) => `/farms/houses/${houseId}/health-levels`,

  // Thiết bị
  SENSOR_NODES: '/devices/sensor-nodes',
  CAMERA_NODES: '/devices/camera-nodes',
  SENSOR_NODE_REGISTER: '/devices/sensor-nodes/register',
  CAMERA_NODE_REGISTER: '/devices/camera-nodes/register',
  // Dời controller sang khu vực khác (FARM-FR-007b); gỡ, khôi phục trong 24 giờ, thay thiết bị (FARM-FR-008)
  SENSOR_NODE_REASSIGN_ZONE: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/reassign-zone`,
  SENSOR_NODE_DECOMMISSION: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/decommission`,
  SENSOR_NODE_RESTORE: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/restore`,
  SENSOR_NODE_REPLACE: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/replace`,
  // Lệnh từ xa (FARM-FR-013): Farm Owner, Farm Technician chỉ gửi được RESTART, thiết bị phải ONLINE
  SENSOR_NODE_COMMANDS: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/commands`,
  CAMERA_NODE_DECOMMISSION: (cameraId: string) => `/devices/camera-nodes/${cameraId}/decommission`,
  CAMERA_NODE_RESTORE: (cameraId: string) => `/devices/camera-nodes/${cameraId}/restore`,
  RELAY_CONTROL: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay`,
  RELAY_OVERRIDE: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay-override`,
  RELAY_OVERRIDES: (sensorNodeId: string) => `/devices/sensor-nodes/${sensorNodeId}/relay-overrides`,
  CAMERA_STREAM_TOKEN: (cameraId: string) => `/devices/camera-nodes/${cameraId}/stream-token`,
  // Vẽ vòng đếm của camera (VISION-FR-018): Domain Expert, Farm Technician nhà được giao, Farm Owner khi farm chưa có chuyên gia
  CAMERA_COUNTING_RING: (cameraId: string) => `/devices/camera-nodes/${cameraId}/counting-ring`,

  // Dữ liệu cảm biến (ENV-FR-*)
  TELEMETRY_LATEST: (zoneId: string) => `/telemetry/zones/${zoneId}/latest`,

  // Cảnh báo (ALERT-FR-*)
  ALERTS: '/alerts',
  ALERT_DETAIL: (alertId: string) => `/alerts/${alertId}`,
  ALERT_ACKNOWLEDGE: (alertId: string) => `/alerts/${alertId}/acknowledge`,
  ALERT_VERDICT: (alertId: string) => `/alerts/${alertId}/verdict`,
  // Bằng chứng ±30 phút của cảnh báo suy luận (ALERT-FR-014)
  ALERT_EVIDENCE: (alertId: string) => `/alerts/${alertId}/evidence`,
  // Thợ của nhà trả lời yêu cầu kiểm tra tại chỗ cảnh báo suy luận (EXPERT-FR-021)
  ALERT_ONSITE_CHECK: (alertId: string) => `/alerts/${alertId}/onsite-check`,

  // Work Order sửa chữa (OPS-FR-001…004, G-21): danh sách, chi tiết, bắt đầu, báo xong
  WORK_ORDERS: '/work-orders',
  WORK_ORDER_DETAIL: (workOrderId: string) => `/work-orders/${workOrderId}`,
  WORK_ORDER_START: (workOrderId: string) => `/work-orders/${workOrderId}/start`,
  WORK_ORDER_DONE: (workOrderId: string) => `/work-orders/${workOrderId}/done`,
  // Farm Owner duyệt, mở lại, huỷ, giao lại (OPS-FR-004)
  WORK_ORDER_APPROVE: (workOrderId: string) => `/work-orders/${workOrderId}/approve`,
  WORK_ORDER_REOPEN: (workOrderId: string) => `/work-orders/${workOrderId}/reopen`,
  WORK_ORDER_CANCEL: (workOrderId: string) => `/work-orders/${workOrderId}/cancel`,
  WORK_ORDER_REASSIGN: (workOrderId: string) => `/work-orders/${workOrderId}/reassign`,
  // Ghi một mục checklist của Work Order phòng ngừa (OPS-FR-007, G-22)
  WORK_ORDER_CHECKLIST: (workOrderId: string) => `/work-orders/${workOrderId}/checklist`,

  // Bảo trì phòng ngừa (OPS-FR-005…008, G-22): kế hoạch, kế hoạch đến hạn hoặc quá hạn
  MAINTENANCE_PLANS: '/maintenance/plans',
  MAINTENANCE_DUE: '/maintenance/due',

  // Hoạt động chuyên gia (EXPERT-FR-009/010/011)
  EXPERT_ACTIVITY: '/expert-activity',
  EXPERT_REVIEWS: '/expert-activity/reviews',
  EXPERT_REVIEW_ACCEPT: (itemId: string) => `/expert-activity/reviews/${itemId}/accept`,
  EXPERT_REVIEW_REVERT: (itemId: string) => `/expert-activity/reviews/${itemId}/revert`,
  EXPERT_PROPOSALS: '/expert-activity/proposals',
  // Farm Owner nhắc chuyên gia việc chỉ chuyên gia làm, mỗi việc một lần (BR-22)
  EXPERT_REMINDERS: '/expert-activity/reminders',
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
  // FCM device token của máy (ALERT-FR-002, G-10): POST đăng ký, DELETE gỡ — theo api-spec của nhánh feat/g10-fcm-push,
  // chưa merge vào develop
  PUSH_TOKENS: '/notifications/push-tokens',

  // Báo cáo sức khoẻ theo nhà (EXPERT-FR-005/006/013)
  HEALTH_REPORTS: '/health-reports',
  // Trạng thái ngày và chấm điểm (ANALYTICS-FR-012, EXPERT-FR-012, BR-31)
  HEALTH_DAYS: '/health-reports/days',
  // Ngày có đánh giá lệch với trạng thái hệ thống (EXPERT-FR-022): Farm Owner, Domain Expert
  HEALTH_DISAGREEMENTS: '/health-reports/disagreements',
  HEALTH_DAY_DETAIL: (dayId: string) => `/health-reports/days/${dayId}`,
  HEALTH_DAY_RATING: (dayId: string) => `/health-reports/days/${dayId}/rating`,
  HEALTH_DAY_SKIP: (dayId: string) => `/health-reports/days/${dayId}/skip`,
  HEALTH_DAY_RATING_NOTE: (dayId: string) => `/health-reports/days/${dayId}/rating/note`,
  HEALTH_REPORT_DETAIL: (reportId: string) => `/health-reports/${reportId}`,
  HEALTH_REPORT_CONCLUSION: (reportId: string) => `/health-reports/${reportId}/conclusion`,

  // Thu hoạch (HARVEST-FR-001…005) — danh sách (GET) và tạo (POST) đợt thu; sửa (PUT), xoá mềm (DELETE) một đợt
  HARVESTS: '/harvests',
  HARVEST_DETAIL: (harvestId: string) => `/harvests/${harvestId}`,
  // Chủ trại xác nhận lô DRAFT của kỹ thuật viên (HARVEST-FR-006)
  HARVEST_CONFIRM: (harvestId: string) => `/harvests/${harvestId}/confirm`,
  // Chu kỳ thu hoạch của zone (HARVEST-FR-007): đọc như lô thu hoạch
  HARVEST_CYCLES: '/harvests/cycles',

  // Khuyến nghị của nhà (EXPERT-FR-017, 018): Farm Owner chấp nhận hoặc từ chối kèm lý do
  RECOMMENDATIONS: '/recommendations',
  RECOMMENDATION_ACCEPT: (recommendationId: string) => `/recommendations/${recommendationId}/accept`,
  RECOMMENDATION_REJECT: (recommendationId: string) => `/recommendations/${recommendationId}/reject`,

  // Nghiệp vụ Chuyên gia bổ sung (Domain Expert: EXPERT-FR-*)
  ALERT_VERDICT_STATS: '/alerts/verdict-stats',
  ZONE_DETAIL: (zoneId: string) => `/farms/zones/${zoneId}`,
} as const
