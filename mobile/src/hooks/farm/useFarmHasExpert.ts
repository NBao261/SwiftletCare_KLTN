import { useFarms } from '@/hooks/farm/useFarms'
import { farmHasExpert } from '@/utils/farm.utils'

// Farm có Domain Expert không (BR-22: không có thì Farm Owner quyết thay); chưa tải xong danh sách farm thì undefined —
// canPerform khi đó không mở thao tác chỉ dành cho farm chưa có chuyên gia
export function useFarmHasExpert(farmId: string): boolean | undefined {
  const farmsQuery = useFarms()
  const farm = farmsQuery.data?.data.find(item => item._id === farmId)
  return farm ? farmHasExpert(farm) : undefined
}
