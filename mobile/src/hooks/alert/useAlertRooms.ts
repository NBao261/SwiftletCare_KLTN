import { useEffect } from 'react'
import { joinHouse, joinZone, leaveHouse, leaveZone } from '@/services/socket/socketClient'

// Vào phòng socket của nhà và các tầng đang xem để nhận ALERT_NEW (backend chỉ gửi cảnh báo mới vào phòng tầng / nhà);
// rời phòng khi đổi nhà hoặc rời màn. socketClient đếm số màn đang dùng mỗi phòng nên không làm mất realtime của màn khác
export function useAlertRooms(houseId: string | null, zoneIds: string[]) {
  const zoneKey = zoneIds.join(',')

  useEffect(() => {
    const ids = zoneKey ? zoneKey.split(',') : []
    if (houseId) joinHouse(houseId)
    ids.forEach(joinZone)
    return () => {
      if (houseId) leaveHouse(houseId)
      ids.forEach(leaveZone)
    }
  }, [houseId, zoneKey])
}
