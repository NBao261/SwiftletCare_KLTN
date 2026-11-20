import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { WeatherRule, WeatherRulesView } from '@/types'

export interface UpdateWeatherRulesInput {
  houseId: string
  rules: WeatherRule[]
}

// Lưu cả danh sách luật bù thời tiết của nhà (ENV-FR-030, BR-38); xong thì thay luật đang hiện bằng bản backend trả. PUT không
// trả last_compensation nên giữ lần bù gần nhất đang có (lưu luật không gửi lần bù nào)
export function useUpdateWeatherRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, rules }: UpdateWeatherRulesInput) =>
      farmApi.updateWeatherRules(houseId, rules).then(response => response.data.data),
    onSuccess: view =>
      queryClient.setQueryData<WeatherRulesView>(['weather-rules', view.house_id], previous => ({
        ...view,
        last_compensation: previous?.last_compensation ?? null,
      })),
  })
}
