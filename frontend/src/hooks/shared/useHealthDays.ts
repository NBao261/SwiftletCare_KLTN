import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { healthDayApi, type HealthDayScope } from '@/apis/shared/healthDays.api'
import type { HealthLevels, HealthRatingState, HealthRatingValue, HealthReportKind, HouseHealthDay } from '@/types'

const HEALTH_DAYS_KEY = 'health-days'
const HEALTH_REPORTS_KEY = 'house-health-reports'

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

// Chấm, bỏ qua, ghi chú đều trả ngày đầy đủ; làm mới mọi danh sách ngày và báo cáo (ngày bị che đổi theo BR-31)
function useDayMutation<Input>(mutate: (input: Input) => Promise<HouseHealthDay>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [HEALTH_DAYS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [HEALTH_REPORTS_KEY] })
    },
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


// EXPERT-FR-005 — báo cáo theo nhà hoặc farm, mới nhất trước; scope null = chưa chọn được phạm vi
export function useHouseHealthReports(scope: { houseId?: string; farmId?: string } | null, kind?: HealthReportKind) {
  return useQuery({
    queryKey: [HEALTH_REPORTS_KEY, scope, kind],
    // ponytail: 100 báo cáo mới nhất (≈ 3 tháng báo cáo ngày của 1 nhà), thêm phân trang server khi cần xem xa hơn
    queryFn: () => healthDayApi.listReports({ ...scope, kind, limit: 100 }).then(response => response.data.data),
    enabled: Boolean(scope),
  })
}

// Chi tiết đọc lại mỗi lần mở: các ngày che theo trạng thái đánh giá hiện tại (BR-31)
export function useHouseHealthReport(reportId: string | undefined) {
  return useQuery({
    queryKey: [HEALTH_REPORTS_KEY, 'detail', reportId],
    queryFn: () => healthDayApi.getReport(reportId!).then(response => response.data.data),
    enabled: Boolean(reportId),
  })
}

export function useCreateHouseHealthReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { houseId: string; from: string; to: string }) =>
      healthDayApi.createReport(input).then(response => response.data.data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [HEALTH_REPORTS_KEY] }),
  })
}
