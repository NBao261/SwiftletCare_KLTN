// DeviceTable.tsx — Bảng danh sách thiết bị với nút "Đẩy OTA"
import { Card } from '@/components/ui'
import StatusDot from '@/components/common/StatusDot'
import { formatDate } from '@/lib/helpers'
import type { SensorNode, DeviceStatus } from '@/types'

interface DeviceRowProps {
  node: SensorNode
  selected: boolean
  onSelect: () => void
}

function DeviceRow({ node, selected, onSelect }: DeviceRowProps) {
  const isOffline = node.status === 'OFFLINE' || node.status === 'ERROR'
  return (
    <tr className={`border-b border-graphite/[0.08] transition-colors hover:bg-graphite/[0.03] ${selected ? 'bg-charcoal/5' : ''}`}>
      <td className="px-4 py-3"><StatusDot status={node.status as DeviceStatus} /></td>
      <td className="px-4 py-3 font-mono text-sm font-semibold text-charcoal">{node.device_id}</td>
      <td className="px-4 py-3 text-warmGray">—</td>
      <td className="px-4 py-3 font-mono text-sm">{node.firmware_version ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-warmGray">
        {node.last_heartbeat ? formatDate(node.last_heartbeat) : '—'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onSelect}
          disabled={isOffline}
          title={isOffline ? 'Thiết bị OFFLINE — không thể đẩy OTA' : ''}
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
  return (
    <Card className="!p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-graphite/10 bg-graphite/[0.03]">
            {['Trạng thái', 'Device ID', 'Zone', 'Firmware', 'Heartbeat', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-warmGray">
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
              selected={selectedId === node._id}
              onSelect={() => onSelect(node)}
            />
          ))}
        </tbody>
      </table>
    </Card>
  )
}
