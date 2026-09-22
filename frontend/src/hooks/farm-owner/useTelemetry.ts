import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { telemetryApi } from '@/apis/farm-owner/telemetry.api'
import { joinZone, leaveZone, onTelemetryUpdate } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { TelemetryUpdateEvent } from '@/types'

/**
 * Nếu không nhận thêm dữ liệu realtime trong khoảng này, coi badge "Live" là hết
 * hạn (thiết bị có thể đã mất kết nối/mất nguồn) — độc lập với backend, vốn chỉ
 * tự chuyển SensorNode.status sang OFFLINE sau 30s không có heartbeat (FARM-FR-005,
 * xem deviceService.markStaleDevicesOffline). Đặt ngắn hơn để UI phản ứng nhanh hơn.
 */
const STALE_TIMEOUT_MS = 20_000

/** useTelemetry – giá trị mới nhất qua REST, sau đó realtime qua Socket.io (ENV-FR-004/005) */
export function useTelemetry(zoneId: string | undefined) {
  useSocket()
  const queryClient = useQueryClient()
  const [live, setLive] = useState<TelemetryUpdateEvent | null>(null)
  const [isStale, setIsStale] = useState(false)
  const lastEventAtRef = useRef<number | null>(null)

  const query = useQuery({
    queryKey: ['telemetry', 'latest', zoneId],
    queryFn: () => telemetryApi.getLatest(zoneId!).then(r => r.data.data),
    enabled: !!zoneId,
    retry: false,
  })

  useEffect(() => {
    if (!zoneId) return
    setLive(null)
    setIsStale(false)
    lastEventAtRef.current = null
    joinZone(zoneId)
    const off = onTelemetryUpdate(data => {
      if (data.zoneId !== zoneId) return
      setLive(data)
      setIsStale(false)
      lastEventAtRef.current = Date.now()
      void queryClient.invalidateQueries({ queryKey: ['telemetry', 'latest', zoneId] })
    })
    const staleCheck = setInterval(() => {
      if (lastEventAtRef.current !== null && Date.now() - lastEventAtRef.current > STALE_TIMEOUT_MS) {
        setIsStale(true)
      }
    }, 2000)
    return () => {
      leaveZone(zoneId)
      off()
      clearInterval(staleCheck)
    }
  }, [zoneId, queryClient])

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    data: {
      temperature: live?.temperature ?? query.data?.temperature,
      humidity:    live?.humidity    ?? query.data?.humidity,
      light_lux:   live?.light       ?? query.data?.light_lux,
      nh3_ppm:     live?.nh3         ?? query.data?.nh3_ppm,
      co2_ppm:     live?.co2         ?? query.data?.co2_ppm,
      sound_db:    live?.sound       ?? query.data?.sound_db,
      timestamp:   live?.timestamp   ?? query.data?.timestamp,
    },
    relayStates: live?.relayStates,
    controlMode: live?.controlMode,
    isLive: !!live && !isStale,
    hasEverReceived: !!live,
  }
}
