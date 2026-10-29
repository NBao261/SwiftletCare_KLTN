import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Danh sách trang trại người dùng được xem
export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => farmApi.list().then(response => response.data),
  })
}
