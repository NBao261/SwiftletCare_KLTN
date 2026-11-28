import api from '@/lib/axios'
import type { ApiResponse, CurrentWeatherResponse } from '@/types'

// Trời đang nắng hay mưa ở ngoài nhà yến (Farm Owner, Domain Expert, Farm Technician của nhà)
export const weatherApi = {
  getCurrent: (houseId: string) =>
    api.get<ApiResponse<CurrentWeatherResponse>>(`/farms/houses/${houseId}/weather/current`),
}
