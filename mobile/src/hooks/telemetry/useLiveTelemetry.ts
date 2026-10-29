import { useEffect, useState } from 'react'
import { joinZone, leaveZone, offTelemetryUpdate, onTelemetryUpdate } from '@/services/socket/socketClient'
import type { SocketTelemetryUpdate } from '@/types'

// Số đo realtime của Zone qua Socket.io — vào phòng khi mở, rời phòng và huỷ đăng ký khi đóng hoặc đổi Zone
export function useLiveTelemetry(zoneId: string) {
  const [liveTelemetry, setLiveTelemetry] = useState<SocketTelemetryUpdate | null>(null)

  useEffect(() => {
    if (!zoneId) return
    const handleUpdate = (update: SocketTelemetryUpdate) => {
      if (update.zoneId === zoneId) setLiveTelemetry(update)
    }
    joinZone(zoneId)
    onTelemetryUpdate(handleUpdate)
    return () => {
      offTelemetryUpdate(handleUpdate)
      leaveZone(zoneId)
    }
  }, [zoneId])

  return liveTelemetry
}
