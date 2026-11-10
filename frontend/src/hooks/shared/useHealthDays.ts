import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { healthDayApi, type HealthDayScope } from '@/apis/shared/healthDays.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { HealthLevels, HealthRatingState, HealthRatingValue, HealthReportKind, HouseHealthDay } from '@/types'

const HEALTH_DAYS_KEY = 'health-days'
const HEALTH_REPORTS_KEY = 'house-health-reports'
// Số báo cáo mỗi trang, cũng là số dòng khung bảng
export const REPORT_PAGE_SIZE = 10

// Mới nhất trước, cùng ngày thì theo tên nhà
function byDateThenHouse(left: HouseHealthDay, right: HouseHealthDay): number {
  return right.date.localeCompare(left.date) || left.house_name.localeCompare(right.house_name)
}

// MF-06 — ngày của 1 nhà, 1 farm, hoặc mọi farm (backend cần houseId hoặc farmId nên mỗi farm 1 request)
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

// Đánh giá, bỏ qua, ghi chú: làm mới ngày và báo cáo; 409 (đã đánh giá nơi khác, vừa quá hạn) cũng làm mới danh sách ngày
function useDayMutation<Input>(mutate: (input: Input) => Promise<HouseHealthDay>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mutate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [HEALTH_DAYS_KEY] })
      void queryClient.invalidateQueries({ queryKey: [HEALTH_REPORTS_KEY] })
    },
    onError: error => {
      if ((error as { response?: { status?: number } }).response?.status === 409) void queryClient.invalidateQueries({ queryKey: [HEALTH_DAYS_KEY] })
    },
  })
}

// CSV các ngày theo phạm vi và ngôn ngữ; trả blob để trang tự lưu file
export function useDownloadHealthCsv() {
  return useMutation({
    mutationFn: (scope: HealthDayScope & { lang: 'vi' | 'en' }) => healthDayApi.downloadCsv(scope).then(response => response.data),
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


// EXPERT-FR-005 — báo cáo theo nhà hoặc farm, mới nhất trước, phân trang server; scope null = chưa chọn được phạm vi
export function useHouseHealthReports(scope: { houseId?: string; farmId?: string } | null, kind: HealthReportKind | undefined, page: number) {
  return usePaginatedListQuery(
    [HEALTH_REPORTS_KEY, scope, kind, page],
    () => healthDayApi.listReports({ ...scope, kind, page, limit: REPORT_PAGE_SIZE }),
    page,
    REPORT_PAGE_SIZE,
    { enabled: Boolean(scope) },
  )
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
