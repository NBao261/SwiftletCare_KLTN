import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alerts'

export function useAlerts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn:  () => alertApi.list(params).then(r => r.data),
  })
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      alertApi.acknowledge(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
