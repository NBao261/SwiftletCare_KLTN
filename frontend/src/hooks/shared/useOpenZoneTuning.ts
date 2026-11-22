import { useNavigate } from 'react-router-dom'
import { useAllZones } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'

// undefined khi danh sách Zone chưa tải, để nút khoá thay vì mở Zone cũ trong store
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
