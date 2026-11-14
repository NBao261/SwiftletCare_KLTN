import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weatherRulesApi } from '@/apis/domain-expert/weatherRules.api'
import type { WeatherRule } from '@/types/expert.types'

export const WEATHER_RULES_KEY = (houseId: string | undefined) =>
  ['weather-rules', houseId] as const

export function useWeatherRules(houseId: string | undefined) {
  return useQuery({
    queryKey: WEATHER_RULES_KEY(houseId),
    queryFn: () => weatherRulesApi.getByHouse(houseId!).then(r => r.data.data),
    enabled: !!houseId,
  })
}

export function useUpdateWeatherRules(houseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rules: WeatherRule[]) =>
      weatherRulesApi.updateByHouse(houseId!, rules).then(r => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEATHER_RULES_KEY(houseId) })
    },
  })
}
