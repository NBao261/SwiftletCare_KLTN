import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { joinZone, leaveZone, offTelemetryUpdate, onTelemetryUpdate } from '@/services/socket/socketClient'
import type { ApiResponse, SocketTelemetryUpdate, TelemetryRecord } from '@/types'

// Số đo realtime của nhiều Zone (ENV-FR-005, ≤ 2 giây): vào phòng từng Zone, có TELEMETRY_UPDATE thì ghi thẳng
// vào cache số đo mới nhất (cùng key với useLatestTelemetryOfZones); việc tải lại 30 giây vẫn giữ để bù khi mất socket
export function useZoneTelemetryStream(zoneIds: string[]) {
  const queryClient = useQueryClient()
  // Chuỗi id ổn định để effect chỉ chạy lại khi danh sách Zone đổi thật
  const zoneKey = [...zoneIds].sort().join(',')

  useEffect(() => {
    const ids = zoneKey ? zoneKey.split(',') : []
    if (ids.length === 0) return

    const handleUpdate = (update: SocketTelemetryUpdate) => {
      const queryKey = ['telemetry', 'latest', update.zoneId]
      const cached = queryClient.getQueryData<ApiResponse<TelemetryRecord | null>>(queryKey)
      // Chưa có bản ghi để ghép (thiếu _id, node_id) thì tải lại từ API
      if (!cached?.data) {
        queryClient.invalidateQueries({ queryKey })
        return
      }
      queryClient.setQueryData<ApiResponse<TelemetryRecord | null>>(queryKey, {
        ...cached,
        data: {
          ...cached.data,
          timestamp: update.timestamp,
          temperature: update.temperature,
          humidity: update.humidity,
          light_lux: update.light,
          nh3_ppm: update.nh3,
          co2_ppm: update.co2,
          sound_db: update.sound,
        },
      })
    }

    ids.forEach(zoneId => joinZone(zoneId))
    onTelemetryUpdate(handleUpdate)
    return () => {
      offTelemetryUpdate(handleUpdate)
      ids.forEach(zoneId => leaveZone(zoneId))
    }
  }, [zoneKey, queryClient])
}
