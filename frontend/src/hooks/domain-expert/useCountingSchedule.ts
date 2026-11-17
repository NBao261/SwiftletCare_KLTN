import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { countingScheduleApi } from '@/apis/domain-expert/countingSchedule.api'
import type { CountingSchedule } from '@/types/expert.types'

const COUNTING_SCHEDULE_KEY = (houseId: string | undefined) => ['counting-schedule', houseId] as const

// VISION-FR-019 — lịch đếm của nhà đang chọn
export function useCountingSchedule(houseId: string | undefined) {
  return useQuery({
    queryKey: COUNTING_SCHEDULE_KEY(houseId),
    queryFn: () => countingScheduleApi.get(houseId!).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}

// Lưu cả lịch; xong thì làm mới lịch, khung hôm nay và lịch sử
export function useUpdateCountingSchedule(houseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (schedule: CountingSchedule) => countingScheduleApi.update(houseId!, schedule).then(response => response.data.data),
    onSuccess: saved => {
      queryClient.setQueryData(COUNTING_SCHEDULE_KEY(houseId), saved)
      void queryClient.invalidateQueries({ queryKey: COUNTING_SCHEDULE_KEY(houseId) })
    },
  })
}
