import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weatherRulesApi } from '@/apis/domain-expert/weatherRules.api'
import type { WeatherRule } from '@/types/expert.types'

export const WEATHER_RULES_KEY = (houseId: string | undefined) =>
  ['weather-rules', houseId] as const

export function useWeatherRules(houseId: string | undefined) {
  return useQuery({
    queryKey: WEATHER_RULES_KEY(houseId),
    queryFn: () => weatherRulesApi.getByHouse(houseId!).then(response => response.data.data),
    enabled: !!houseId,
  })
}

export function useUpdateWeatherRules(houseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rules: WeatherRule[]) =>
      weatherRulesApi.updateByHouse(houseId!, rules).then(response => response.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEATHER_RULES_KEY(houseId) })
    },
  })
}

// BR-22, BR-38 — đề xuất luật của Farm Owner và quyết định của chuyên gia; xong thì đọc lại luật và đề xuất của nhà
function useWeatherProposalMutation<TInput>(houseId: string | undefined, call: (houseId: string, input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => call(houseId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEATHER_RULES_KEY(houseId) })
    },
  })
}

export const useProposeWeatherRules = (houseId: string | undefined) =>
  useWeatherProposalMutation(houseId, (id, rules: WeatherRule[]) => weatherRulesApi.propose(id, rules))

export const useApproveWeatherProposal = (houseId: string | undefined) =>
  useWeatherProposalMutation(houseId, (id, _input: void) => weatherRulesApi.approveProposal(id))

export const useRejectWeatherProposal = (houseId: string | undefined) =>
  useWeatherProposalMutation(houseId, (id, note: string) => weatherRulesApi.rejectProposal(id, note))
