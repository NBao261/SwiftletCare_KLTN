import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { CountingSchedule, CountingScheduleView } from '@/types/expert.types'

// lịch đếm của nhà: đọc kèm khung hôm nay và lịch sử; đặt thì thay cả lịch, áp từ ngày hôm sau
export const countingScheduleApi = {
  get: (houseId: string) =>
    api.get<ApiResponse<CountingScheduleView>>(`/farms/houses/${houseId}/counting-schedule`),

  update: (houseId: string, schedule: CountingSchedule) =>
    api.put<ApiResponse<CountingScheduleView>>(`/farms/houses/${houseId}/counting-schedule`, schedule),
}
