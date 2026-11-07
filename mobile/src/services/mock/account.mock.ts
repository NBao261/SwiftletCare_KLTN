import { MOCK_DELAY_MS } from '@/constants/mockApi'
import type { ApiResponse, Invitation, NotificationChannelPreferences } from '@/types'

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
