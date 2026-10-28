import { useEffect, useState } from 'react'
import { joinZone, leaveZone, onTelemetryUpdate } from '@/services/socket/socketClient'
import type { SocketTelemetryUpdate } from '@/types'

// Số đo realtime của Zone qua Socket.io — vào phòng khi mở, rời phòng khi đóng hoặc đổi Zone
export function useLiveTelemetry(zoneId: string) {
  const [liveTelemetry, setLiveTelemetry] = useState<SocketTelemetryUpdate | null>(null)

  useEffect(() => {
    if (!zoneId) return
    joinZone(zoneId)
    // Chưa làm: huỷ đăng ký sự kiện trong cleanup khi socketClient có hàm off*
    onTelemetryUpdate(update => {
      if (update.zoneId === zoneId) setLiveTelemetry(update)
    })
    return () => {
      leaveZone(zoneId)
    }
  }, [zoneId])

  return liveTelemetry
}
