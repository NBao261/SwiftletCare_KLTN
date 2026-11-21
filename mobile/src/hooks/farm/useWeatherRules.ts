import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Luật bù thời tiết của một nhà và lần bù gần nhất (ENV-FR-030); chủ trại, chuyên gia, kỹ thuật viên của nhà đều đọc được
export function useWeatherRules(houseId: string) {
  return useQuery({
    queryKey: ['weather-rules', houseId],
    queryFn: () => farmApi.getWeatherRules(houseId).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}
