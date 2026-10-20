import { useMemo } from 'react'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { useTicketsList } from '@/hooks/shared/useTickets'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { SEVERITY_TO_LEVEL } from '@/constants/severity'
import type { Alert, AlertSeverity, AlertType, TicketPriority } from '@/types'

// Loại cảnh báo lỗi thiết bị cần gửi kỹ thuật viên
const DEVICE_FAULT_ALERT_TYPES = [
  'NODE_OFFLINE', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE', 'PUMP_DRY', 'POWER_OUTAGE', 'EDGE_AI_DEGRADED',
] as const satisfies readonly AlertType[]

export type DeviceFaultType = typeof DEVICE_FAULT_ALERT_TYPES[number]

function isDeviceFault(alert: Alert): alert is Alert & { type: DeviceFaultType } {
  return (DEVICE_FAULT_ALERT_TYPES as readonly AlertType[]).includes(alert.type)
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export interface DeviceFaultRow {
  alert: Alert & { type: DeviceFaultType }
  // Mã thiết bị in trên nhãn
  deviceName?: string
}

// Mã thiết bị trong payload firmware gửi lên
function rawDeviceId(alert: Alert): string | undefined {
  const raw = alert.metadata?.raw as { deviceId?: unknown } | undefined
  return typeof raw?.deviceId === 'string' ? raw.deviceId : undefined
}

// Cảnh báo lỗi thiết bị đang mở (ACTIVE + ACKNOWLEDGED) CHƯA có ticket — đã có ticket (tạo tay hoặc job tự sinh) thì ẩn khỏi khung báo lỗi
export function useDeviceFaultAlerts() {
  const active = useAlertsList({ status: 'ACTIVE', limit: 50 })
  const acknowledged = useAlertsList({ status: 'ACKNOWLEDGED', limit: 50 })
  // 100 ticket mới nhất là đủ: ticket gắn cảnh báo đang mở luôn là ticket gần đây
  const recentTickets = useTicketsList({ limit: 100 })
  // Không truyền zone: backend trả mọi thiết bị trong các zone user được xem — tra node_id → device_id
  const { data: nodes } = useSensorNodes()

  return useMemo(() => {
    // Cảnh báo đã gắn ticket còn hiệu lực (mọi trạng thái trừ đã huỷ) — ticket huỷ thì cảnh báo hiện lại để tạo mới
    const alertIdsWithTicket = new Set<string>()
    for (const ticket of recentTickets.records) {
      if (ticket.alert_id && !ticket.cancelled_at) alertIdsWithTicket.add(ticket.alert_id)
    }
    const deviceIdByNode = new Map((nodes ?? []).map(node => [node._id, node.device_id]))

    const rows: DeviceFaultRow[] = [...active.records, ...acknowledged.records]
      .filter(isDeviceFault)
      .filter(alert => !alertIdsWithTicket.has(alert._id))
      .sort((first, second) => SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity] || second.created_at.localeCompare(first.created_at))
      .map(alert => ({
        alert,
        deviceName: (alert.node_id ? deviceIdByNode.get(alert.node_id) : undefined) ?? rawDeviceId(alert),
      }))

    const byLevel: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0 }
    for (const row of rows) byLevel[SEVERITY_TO_LEVEL[row.alert.severity]] += 1

    return { rows, byLevel, isLoading: active.isLoading || acknowledged.isLoading }
  }, [active.records, acknowledged.records, recentTickets.records, nodes, active.isLoading, acknowledged.isLoading])
}
