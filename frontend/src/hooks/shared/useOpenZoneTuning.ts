import { useNavigate } from 'react-router-dom'
import { useAllZones } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'

// Mở /domain-expert/tuning, nơi duy nhất sửa ngưỡng và hệ số mờ, với đúng Zone được chọn sẵn trên thanh chọn.
// Trả undefined khi danh sách Zone chưa tải xong, để nút khoá lại thay vì mở trang trên Zone cũ còn lưu trong store
export function useOpenZoneTuning(): ((zoneId: string) => void) | undefined {
  const navigate = useNavigate()
  const { data: zones } = useAllZones()
  const setHouse = useZoneStore(state => state.setHouse)
  const setZone = useZoneStore(state => state.setZone)
  if (!zones) return undefined
  return zoneId => {
    const zone = zones.find(item => item._id === zoneId)
    if (!zone) return
    setHouse(zone.house_id)
    setZone(zone.farmId, zone.farmName, zone._id, zone.name)
    navigate('/domain-expert/tuning')
  }
}
