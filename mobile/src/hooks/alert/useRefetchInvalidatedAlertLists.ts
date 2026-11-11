import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { watchInvalidatedAlertLists } from '@/config/queryClient'

// Danh sách cảnh báo bị đánh dấu cũ (invalidateAlertQueries) chỉ tải lại khi tab Cảnh báo đang hiện
export function useRefetchInvalidatedAlertLists(isFocused: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isFocused) return
    return watchInvalidatedAlertLists(queryClient)
  }, [isFocused, queryClient])
}
