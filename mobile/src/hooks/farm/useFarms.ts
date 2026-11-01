import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import { sortByCreationOrder } from '@/utils/sort.utils'

// Danh sách trang trại người dùng được xem, farm tạo trước đứng đầu
export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => farmApi.list().then(response => response.data),
    select: response => ({ ...response, data: sortByCreationOrder(response.data) }),
  })
}
