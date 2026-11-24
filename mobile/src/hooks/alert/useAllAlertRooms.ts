import { useEffect } from 'react'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { joinHouse, joinZone, leaveHouse, leaveZone } from '@/services/socket/socketClient'

// Vào phòng socket của mọi nhà và tầng người dùng được xem, cho cả phiên đăng nhập: backend chỉ gửi ALERT_NEW vào phòng nhà /
// tầng, nên chuông và tab Cảnh báo cần ở trong mọi phòng để số tăng ngay ở bất kỳ màn nào. socketClient đếm số màn dùng mỗi
// phòng (màn khác rời phòng không làm mất phòng này) và tự vào lại sau khi nối lại
export function useAllAlertRooms() {
  const directory = useZoneDirectory()
  // Khoá chuỗi để effect chỉ chạy lại khi danh sách nhà / tầng thật sự đổi, không phải mỗi lần vẽ lại
  const houseKey = [...directory.houseById.keys()].sort().join(',')
  const zoneKey = [...directory.zoneById.keys()].sort().join(',')

  useEffect(() => {
    const houseIds = houseKey ? houseKey.split(',') : []
    const zoneIds = zoneKey ? zoneKey.split(',') : []
    houseIds.forEach(joinHouse)
    zoneIds.forEach(joinZone)
    return () => {
      houseIds.forEach(leaveHouse)
      zoneIds.forEach(leaveZone)
    }
  }, [houseKey, zoneKey])
}
