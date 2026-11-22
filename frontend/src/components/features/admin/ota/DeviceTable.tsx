// DeviceTable.tsx: Bảng danh sách thiết bị với nút "Đẩy OTA" Cột "Cập nhật" đọc trực tiếp ota_pending / ota_failed của node (không suy diễn "bản mới nhất" vì BE không có catalog firmware).
import { useMemo } from 'react'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { HeartbeatTime } from '@/components/features/admin/devices/deviceColumns'
import { useSystemNodeStatus } from '@/hooks/shared/useDevices'
import type { SensorNode, DeviceStatus } from '@/types'

interface DeviceRowProps {
  node: SensorNode
  // Trang trại · nhà · Zone (GET /devices/system-status; tên Zone đã có tầng); chưa tải xong thì '—'
  location: string
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

function DeviceRow({ node, location, selected, onSelect }: DeviceRowProps) {
  // DEGRADED đã bỏ: chỉ node ONLINE mới nhận lệnh từ xa
  const isOffline = node.status !== 'ONLINE'
  // Viền trái: đang chọn → đen; OTA đang chờ → cam; OTA lỗi → đỏ; còn lại không viền
  const accent = selected ? 'bg-charcoal' : node.ota_pending ? 'bg-climateOrange' : node.ota_failed ? 'bg-alertRed' : 'bg-transparent'
  return (
    <tr className={`border-b border-graphite/[0.08] transition-colors duration-200 hover:bg-graphite/[0.03] ${selected ? 'bg-charcoal/5' : ''}`}>
      <td className="relative px-4 py-3">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] transition-colors duration-200 ${accent}`} />
        <StatusDot status={node.status as DeviceStatus} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-charcoal">{node.device_id}</span>
          <SimulatedBadge simulated={node.simulated} />
        </div>
      </td>
      <td className="px-4 py-3 text-graphite">{location}</td>
      <td className="px-4 py-3 text-sm">{node.firmware_version ?? '—'}</td>
      <td className="px-4 py-3 text-sm"><OtaChip node={node} /></td>
      <td className="px-4 py-3 text-sm">
        <HeartbeatTime at={node.last_heartbeat} />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onSelect}
          disabled={isOffline}
          title={isOffline ? 'Chỉ thiết bị đang online mới nhận được bản cập nhật' : ''}
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
  // Vị trí theo tên (FE_Design 13.16 a) từ danh sách thiết bị toàn hệ thống của Admin: Admin không đọc cấu trúc farm
  const { data: systemStatus } = useSystemNodeStatus()
  const locationById = useMemo(
    () => new Map((systemStatus?.nodes ?? []).map(item => [item._id, [item.farm_name, item.house_name, item.zone_name].filter(Boolean).join(' · ')])),
    [systemStatus],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warmGray/15 bg-warmGray/5">
            {['Trạng thái', 'Thiết bị', 'Vị trí', 'Firmware', 'Cập nhật', 'Kết nối cuối', ''].map((h, i) => (
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
              location={locationById.get(node._id) || '—'}
              selected={selectedId === node._id}
              onSelect={() => onSelect(node)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
