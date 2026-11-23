import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { ExpertQueue } from '@/types/expert/queue.types'

// Mọi việc đang chờ chuyên gia của một trại
export const queueApi = {
  get: (farmId: string) => api.get<ApiResponse<ExpertQueue>>('/expert-activity/queue', { params: { farmId } }),
}
