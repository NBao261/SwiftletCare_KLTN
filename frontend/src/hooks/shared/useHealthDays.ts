import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { healthDayApi, type HealthDayScope } from '@/apis/shared/healthDays.api'
import type { HealthLevels, HealthRatingState, HealthRatingValue, HouseHealthDay } from '@/types'

const HEALTH_DAYS_KEY = 'health-days'

// Mới nhất trước, cùng ngày thì theo tên nhà
function byDateThenHouse(left: HouseHealthDay, right: HouseHealthDay): number {
  return right.date.localeCompare(left.date) || left.house_name.localeCompare(right.house_name)
}

// MF-11 — ngày của 1 nhà, 1 farm, hoặc mọi farm (backend cần houseId hoặc farmId nên mỗi farm 1 request)
export function useHealthDays(params: {
  farmIds: string[]
  houseId: string
  from: string
  to: string
  myRatingState?: HealthRatingState
}) {
  const scopes: HealthDayScope[] = params.houseId
    ? [{ houseId: params.houseId }]
    : params.farmIds.map(farmId => ({ farmId }))
  return useQueries({
    queries: scopes.map(scope => {
      const query = { ...scope, from: params.from, to: params.to, myRatingState: params.myRatingState }
      return {
        queryKey: [HEALTH_DAYS_KEY, query],
        queryFn: () => healthDayApi.list(query).then(response => response.data.data),
      }
    }),
    combine: results => ({
      days: results.flatMap(result => result.data ?? []).sort(byDateThenHouse),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      error: results.find(result => result.error)?.error ?? null,
      refetch: () => results.forEach(result => void result.refetch()),
    }),
  })
}

// Chấm, bỏ qua, ghi chú đều trả ngày đầy đủ; làm mới mọi danh sách ngày (trạng thái chấm đổi)
function useDayMutation<Input>(mutate: (input: Input) => Promise<HouseHealthDay>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutate,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [HEALTH_DAYS_KEY] }),
  })
}

export function useRateHealthDay() {
  return useDayMutation((input: { dayId: string; rating: HealthRatingValue; note?: string }) =>
    healthDayApi.rate(input.dayId, { rating: input.rating, note: input.note }).then(response => response.data.data))
}

export function useSkipHealthDay() {
  return useDayMutation((dayId: string) => healthDayApi.skip(dayId).then(response => response.data.data))
}

export function useAddHealthRatingNote() {
  return useDayMutation((input: { dayId: string; note: string }) =>
    healthDayApi.addNote(input.dayId, input.note).then(response => response.data.data))
}

// BR-28 — mức chỉ số của 1 nhà
export function useHealthLevels(houseId: string) {
  return useQuery({
    queryKey: ['health-levels', houseId],
    queryFn: () => healthDayApi.getLevels(houseId).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}

export function useUpdateHealthLevels(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (levels: Partial<HealthLevels>) => healthDayApi.updateLevels(houseId, levels).then(response => response.data.data),
    onSuccess: data => queryClient.setQueryData(['health-levels', houseId], data),
  })
}
