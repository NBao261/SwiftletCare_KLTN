import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { WeatherRule, WeatherRulesResponse } from '@/types/expert.types'

// ENV-FR-030 — Luật bù phun sương theo thời tiết của nhà
export const weatherRulesApi = {
  getByHouse: (houseId: string) =>
    api.get<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules`),

  updateByHouse: (houseId: string, rules: WeatherRule[]) =>
    api.put<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules`, { rules }),
}
