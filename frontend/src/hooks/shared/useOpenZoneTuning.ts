import { useNavigate } from 'react-router-dom'
import { useAllZones } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'

// Mở /domain-expert/tuning, nơi duy nhất sửa ngưỡng và hệ số mờ, với đúng Zone được chọn sẵn trên thanh chọn
export function useOpenZoneTuning(): (zoneId: string) => void {
  const navigate = useNavigate()
  const { data: zones } = useAllZones()
  const setHouse = useZoneStore(state => state.setHouse)
  const setZone = useZoneStore(state => state.setZone)
  return zoneId => {
    const zone = zones?.find(item => item._id === zoneId)
    if (zone) {
      setHouse(zone.house_id)
      setZone(zone.farmId, zone.farmName, zone._id, zone.name)
    }
    navigate('/domain-expert/tuning')
  }
}
