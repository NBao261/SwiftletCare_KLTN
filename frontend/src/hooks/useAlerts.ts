import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/services/api'
import { useAlertStore } from '@/store/alertStore'
import type { AlertSeverity, AlertStatus } from '@/types'

export interface AlertsListQuery {
  farmId?: string; zoneId?: string
  status?: AlertStatus; severity?: AlertSeverity
  page?: number; limit?: number
}

/** Danh sách cảnh báo + đồng bộ badge chuông từ meta.unreadCount (ALERT-FR-007) */
export function useAlertsList(query: AlertsListQuery) {
  const setUnreadCount = useAlertStore(s => s.setUnreadCount)

  const result = useQuery({
    queryKey: ['alerts', query],
    queryFn: () => alertApi.list(query as Record<string, string>),
  })

  useEffect(() => {
    const unread = result.data?.data.meta?.unreadCount
    if (typeof unread === 'number') setUnreadCount(unread)
  }, [result.data, setUnreadCount])

  return {
    records: result.data?.data.data ?? [],
    total: result.data?.data.meta?.total ?? 0,
    page: result.data?.data.meta?.page ?? query.page ?? 1,
    limit: result.data?.data.meta?.limit ?? query.limit ?? 20,
    isLoading: result.isLoading,
  }
}

/** ALERT-FR-009 — xác nhận cảnh báo kèm ghi chú tùy chọn */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertApi.acknowledge(id, note),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
