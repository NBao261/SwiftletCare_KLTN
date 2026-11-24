import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Áp gợi ý hệ số của zone (EXPERT-FR-011, POST …/fuzzy-tuning/apply-suggestion): server tính lại gợi ý nên không gửi số
// đã lưu trên máy; xong thì tải lại zone, phân tích và lịch sử hoạt động chuyên gia
export function useApplySuggestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (zoneId: string) => farmApi.applySuggestion(zoneId).then(response => response.data.data),
    onSuccess: zone => {
      void queryClient.invalidateQueries({ queryKey: ['zones', zone.house_id] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['expert-activity'] })
    },
  })
}
