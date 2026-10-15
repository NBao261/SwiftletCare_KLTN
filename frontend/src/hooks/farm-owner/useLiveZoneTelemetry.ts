import { useEffect, useMemo, useState } from 'react'
import { joinZone, leaveZone, onRelayUpdate, onTelemetryUpdate } from '@/lib/socket'
import { useSocket } from '@/hooks/common/useSocket'
import type { ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import type { ControlOutput, RelayStates } from '@/types'

const FLUSH_DELAY_MS = 200

export interface LiveZone extends ZoneMetrics {
  relayStates?: Partial<RelayStates>
  controlOutput?: ControlOutput
}

// Số đo + relay realtime của nhiều zone qua 1 listener socket, gom gói tin dồn dập thành 1 lần render sau ≤200ms
export function useLiveZoneTelemetry(zoneIds: string[]): Map<string, LiveZone> {
  useSocket()
  const [snapshot, setSnapshot] = useState<Map<string, LiveZone>>(() => new Map())
  const key = useMemo(() => zoneIds.join(','), [zoneIds])

  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    const watched = new Set(ids)
    const pending = new Map<string, LiveZone>()
    let timer: ReturnType<typeof setTimeout> | undefined
    for (const id of ids) joinZone(id)

    const flush = () => {
      timer = undefined
      const batch = new Map(pending)
      pending.clear()
      setSnapshot(prev => {
        const next = new Map(prev)
        for (const [id, patch] of batch) {
          const old = next.get(id)
          next.set(id, { ...old, ...patch, relayStates: { ...old?.relayStates, ...patch.relayStates } })
        }
        return next
      })
    }

    const queue = (zoneId: string, patch: LiveZone) => {
      const old = pending.get(zoneId)
      pending.set(zoneId, { ...old, ...patch, relayStates: { ...old?.relayStates, ...patch.relayStates } })
      timer ??= setTimeout(flush, FLUSH_DELAY_MS)
    }

    const offTelemetry = onTelemetryUpdate(e => {
      if (!watched.has(e.zoneId)) return
      queue(e.zoneId, {
        temperature: e.temperature, humidity: e.humidity, light: e.light, nh3: e.nh3, co2: e.co2, sound: e.sound,
        timestamp: e.timestamp, relayStates: e.relayStates, controlOutput: e.controlOutput,
      })
    })
    const offRelay = onRelayUpdate(e => {
      if (!watched.has(e.zoneId)) return
      queue(e.zoneId, { relayStates: { [e.relayName]: e.state } })
    })

    return () => {
      offTelemetry()
      offRelay()
      if (timer) clearTimeout(timer)
      for (const id of ids) leaveZone(id)
    }
  }, [key])

  return snapshot
}
