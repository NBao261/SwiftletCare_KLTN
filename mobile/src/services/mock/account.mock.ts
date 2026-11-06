import { MOCK_DELAY_MS } from '@/constants/mockApi'
import type {
  ApiResponse,
  ExpertDecision,
  Invitation,
  NotificationChannelPreferences,
  ReviewItem,
} from '@/types'

// Dữ liệu mẫu của trang Tài khoản cho mục Report 3 mà backend chưa có route. Tên, email đều là mẫu hiển nhiên,
// màn luôn gắn nhãn "Dữ liệu mẫu". Xoá file này khi mọi route đã có trong api-spec

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Mốc thời gian lùi từ lúc mở app, để dữ liệu mẫu luôn trông "gần đây"
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

// Trả dữ liệu như axios trả { data: ApiResponse }, sau một khoảng trễ giả
export function mockResponse<Data>(data: Data, meta?: ApiResponse<Data>['meta']): Promise<{ data: ApiResponse<Data> }> {
  return new Promise(resolve => setTimeout(() => resolve({ data: { data, meta } }), MOCK_DELAY_MS))
}

// EXPERT-FR-009: quyết định của chuyên gia trên farm
export const MOCK_EXPERT_DECISIONS: ExpertDecision[] = [
  {
    _id: 'mock-decision-1',
    type: 'ALERT_VERDICT',
    actor_name: 'Chuyên gia mẫu',
    actor_role: 'DOMAIN_EXPERT',
    created_at: hoursAgo(3),
    house_name: 'Nhà mẫu A',
    zone_name: 'Khu vực mẫu 1',
    verdict: 'REJECTED',
    note: 'Ghi chú mẫu',
  },
  {
    _id: 'mock-decision-2',
    type: 'THRESHOLDS',
    actor_name: 'Chuyên gia mẫu',
    actor_role: 'DOMAIN_EXPERT',
    created_at: hoursAgo(26),
    house_name: 'Nhà mẫu A',
    zone_name: 'Khu vực mẫu 1',
    old_value: 'humidity_min 75',
    new_value: 'humidity_min 78',
  },
  {
    _id: 'mock-decision-3',
    type: 'CONCLUSION',
    actor_name: 'Chuyên gia mẫu',
    actor_role: 'DOMAIN_EXPERT',
    created_at: hoursAgo(72),
    house_name: 'Nhà mẫu A',
  },
]

// EXPERT-FR-010/011: thay đổi của chính Farm Owner đang chờ hoặc đã được chuyên gia xử lý
export const MOCK_REVIEW_ITEMS: ReviewItem[] = [
  {
    _id: 'mock-review-1',
    kind: 'CHANGE_REVIEW',
    group: 'THRESHOLDS',
    status: 'PENDING_REVIEW',
    house_name: 'Nhà mẫu A',
    zone_name: 'Khu vực mẫu 1',
    old_value: 'temp_max 31',
    new_value: 'temp_max 32',
    created_at: hoursAgo(5),
  },
  {
    _id: 'mock-review-2',
    kind: 'SUGGESTION_PROPOSAL',
    group: 'FUZZY_TUNING',
    status: 'APPROVED',
    house_name: 'Nhà mẫu A',
    zone_name: 'Khu vực mẫu 2',
    old_value: 'fuzzy_humidity_band 8',
    new_value: 'fuzzy_humidity_band 10',
    created_at: hoursAgo(50),
    resolved_at: hoursAgo(30),
  },
]

// Report 3 §6.4: lời mời còn chờ (hạn 7 ngày). Không có token — danh sách không bao giờ trả token
export function buildMockPendingInvitations(farmId: string): Invitation[] {
  return [
    {
      _id: 'mock-invitation-1',
      farm_id: farmId,
      invited_email: 'chuyengia.mau@example.com',
      invited_role: 'DOMAIN_EXPERT',
      invited_by: 'mock-user',
      status: 'PENDING',
      created_at: hoursAgo(20),
      expires_at: new Date(Date.now() + 7 * DAY_MS - 20 * HOUR_MS).toISOString(),
    },
  ]
}

// ALERT-FR-005: giữ trong bộ nhớ để công tắc đổi được khi chạy thử; tắt app là mất
export const mockNotificationChannels: NotificationChannelPreferences = {}
