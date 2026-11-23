import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { WeatherRule, WeatherRulesView } from '@/types'
import { readApiError } from '@/utils/apiError.utils'

export interface ProposeWeatherRulesInput {
  houseId: string
  rules: WeatherRule[]
}

// Farm Owner gửi bộ luật thời tiết cho chuyên gia duyệt (BR-22 nhóm B): luật đang chạy giữ nguyên, đề xuất mới thay đề xuất cũ
// trong cache. 409 là farm vừa không còn chuyên gia: đọc lại từ đầu để màn chuyển sang đặt thẳng
export function useProposeWeatherRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, rules }: ProposeWeatherRulesInput) =>
      farmApi.proposeWeatherRules(houseId, rules).then(response => response.data.data),
    onSuccess: (proposal, { houseId }) =>
      queryClient.setQueryData<WeatherRulesView>(['weather-rules', houseId], previous =>
        previous ? { ...previous, proposal } : previous,
      ),
    onError: (error, { houseId }) => {
      if (readApiError(error).status !== 409) return
      void queryClient.invalidateQueries({ queryKey: ['weather-rules', houseId] })
      void queryClient.invalidateQueries({ queryKey: ['farms'] })
    },
  })
}
