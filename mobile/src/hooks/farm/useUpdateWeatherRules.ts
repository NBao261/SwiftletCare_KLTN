import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { WeatherRule } from '@/types'

export interface UpdateWeatherRulesInput {
  houseId: string
  rules: WeatherRule[]
}

// Lưu cả danh sách luật bù thời tiết của nhà (ENV-FR-030, BR-38); xong thì thay dữ liệu đang hiện bằng bản backend trả
export function useUpdateWeatherRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, rules }: UpdateWeatherRulesInput) =>
      farmApi.updateWeatherRules(houseId, rules).then(response => response.data.data),
    onSuccess: view => queryClient.setQueryData(['weather-rules', view.house_id], view),
  })
}
