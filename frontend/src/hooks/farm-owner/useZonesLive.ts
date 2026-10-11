import { useEffect, useMemo, useState } from 'react'
import { joinZone, leaveZone, onTelemetryUpdate } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'

/** Gộp các sự kiện socket dồn dập thành 1 lần cập nhật state / giây — telemetry có thể về mỗi vài giây trên mỗi zone */
const FLUSH_INTERVAL_MS = 1000

/**
 * Số đo realtime (TELEMETRY_UPDATE) của NHIỀU zone qua 1 lần đăng ký listener duy nhất
 * — thay vì mỗi card gọi `useTelemetry` riêng (mỗi hook = 1 request REST + 1 listener +
 * 1 lần lọc sự kiện). Mỗi sự kiện chỉ tốn 1 phép tra Set + 1 lần ghi Map (O(1)); state
 * chỉ đổi tối đa 1 lần/giây nên React không render lại theo từng gói tin.
 */
export function useZonesLive(zoneIds: string[]): Map<string, ZoneMetrics> {
  useSocket()
  const [snapshot, setSnapshot] = useState<Map<string, ZoneMetrics>>(() => new Map())
  const key = useMemo(() => zoneIds.join(','), [zoneIds])

  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    const watched = new Set(ids)
    const pending = new Map<string, ZoneMetrics>()
    for (const id of ids) joinZone(id)

    const off = onTelemetryUpdate(e => {
      if (!watched.has(e.zoneId)) return
      pending.set(e.zoneId, { temperature: e.temperature, humidity: e.humidity, light: e.light, nh3: e.nh3, co2: e.co2, sound: e.sound })
    })
    const flush = setInterval(() => {
      if (pending.size === 0) return
      const batch = new Map(pending)
      pending.clear()
      setSnapshot(prev => {
        const next = new Map(prev)
        for (const [id, m] of batch) next.set(id, m)
        return next
      })
    }, FLUSH_INTERVAL_MS)

    return () => {
      off()
      clearInterval(flush)
      for (const id of ids) leaveZone(id)
    }
  }, [key])

  return snapshot
}
