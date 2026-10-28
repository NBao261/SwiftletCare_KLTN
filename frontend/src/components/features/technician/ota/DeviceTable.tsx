// DeviceTable.tsx — Bảng danh sách thiết bị với nút "Đẩy OTA"
// Cột "Cập nhật" đọc trực tiếp ota_pending / ota_failed của node (không suy diễn "bản mới nhất" vì BE không có catalog firmware).
import { useMemo } from 'react'
import { Card } from '@/components/ui'
import StatusDot from '@/components/common/StatusDot'
import { formatDate } from '@/lib/helpers'
import { useAllZones } from '@/hooks/shared/useFarms'
import type { SensorNode, DeviceStatus } from '@/types'

interface DeviceRowProps {
  node: SensorNode
  // Tên Zone kèm nhà; chưa tải xong thì '—'
  zoneName: string
  selected: boolean
  onSelect: () => void
}

function OtaChip({ node }: { node: SensorNode }) {
  if (node.ota_pending) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-climateOrange/15 px-2.5 py-1 text-xs font-semibold text-charcoal">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-climateOrange motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-climateOrange" />
        </span>
        Đang cập nhật · {node.ota_pending.version}
      </span>
    )
  }
  if (node.ota_failed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-alertRed/10 px-2.5 py-1 text-xs font-semibold text-alertRed">
        <span className="h-1.5 w-1.5 rounded-full bg-alertRed" />
        Lỗi · {node.ota_failed.version}
      </span>
    )
  }
  return <span className="text-warmGray">—</span>
}

function DeviceRow({ node, zoneName, selected, onSelect }: DeviceRowProps) {
  // DEGRADED đã bỏ (SRS 3.1.0): chỉ node ONLINE mới nhận lệnh từ xa
  const isOffline = node.status !== 'ONLINE'
  // Viền trái: đang chọn → đen; OTA đang chờ → cam; OTA lỗi → đỏ; còn lại không viền
  const accent = selected ? 'bg-charcoal' : node.ota_pending ? 'bg-climateOrange' : node.ota_failed ? 'bg-alertRed' : 'bg-transparent'
  return (
    <tr className={`border-b border-graphite/[0.08] transition-colors duration-200 hover:bg-graphite/[0.03] ${selected ? 'bg-charcoal/5' : ''}`}>
      <td className="relative px-4 py-3">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] transition-colors duration-200 ${accent}`} />
        <StatusDot status={node.status as DeviceStatus} />
      </td>
      <td className="px-4 py-3 font-mono text-sm font-semibold text-charcoal">{node.device_id}</td>
      <td className="px-4 py-3 text-warmGray">{zoneName}</td>
      <td className="px-4 py-3 font-mono text-sm">{node.firmware_version ?? '—'}</td>
      <td className="px-4 py-3 text-sm"><OtaChip node={node} /></td>
      <td className="px-4 py-3 text-xs text-warmGray">
        {node.last_heartbeat ? formatDate(node.last_heartbeat) : '—'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onSelect}
          disabled={isOffline}
          title={isOffline ? 'Thiết bị không ONLINE — không thể đẩy OTA' : ''}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            isOffline
              ? 'cursor-not-allowed bg-graphite/15 text-warmGray opacity-40'
              : 'bg-charcoal text-white hover:bg-charcoal/90'
          }`}
        >
          Đẩy OTA
        </button>
      </td>
    </tr>
  )
}

interface Props {
  nodes: SensorNode[]
  selectedId?: string
  onSelect: (node: SensorNode) => void
}

export function DeviceTable({ nodes, selectedId, onSelect }: Props) {
  // Tên Zone thay cho mã cắt từ id (FE_Design 13.16 a)
  const { data: zones } = useAllZones()
  const zoneNameById = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, `${zone.houseName} · ${zone.name}`])), [zones])

  return (
    <Card className="!p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 bg-graphite/[0.03]">
            {['Trạng thái', 'Device ID', 'Zone', 'Firmware', 'Cập nhật', 'Heartbeat', ''].map((h, i) => (
              <th key={h || `col-${i}`} className="px-4 py-3 text-left label-caption">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map(node => (
            <DeviceRow
              key={node._id}
              node={node}
              zoneName={zoneNameById.get(node.zone_id) ?? '—'}
              selected={selectedId === node._id}
              onSelect={() => onSelect(node)}
            />
          ))}
        </tbody>
      </table>
    </Card>
  )
}
