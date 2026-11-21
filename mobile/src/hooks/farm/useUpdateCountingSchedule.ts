import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { CountingSchedule } from '@/types'

export interface UpdateCountingScheduleInput {
  houseId: string
  schedule: CountingSchedule
}

// Lưu cả lịch đếm của nhà (VISION-FR-019); xong thì thay dữ liệu đang hiện, tải lại số chim vì khung phiên có thể đã đổi
export function useUpdateCountingSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, schedule }: UpdateCountingScheduleInput) =>
      farmApi.updateCountingSchedule(houseId, schedule).then(response => response.data.data),
    onSuccess: view => {
      queryClient.setQueryData(['counting-schedule', view.house_id], view)
      return queryClient.invalidateQueries({ queryKey: ['bird-count'] })
    },
  })
}
