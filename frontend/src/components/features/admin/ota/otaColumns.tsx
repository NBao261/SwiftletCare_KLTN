// AD-01 — cột bảng Cập nhật firmware (DataTable); cột "Cập nhật" đọc thẳng ota_pending / ota_failed của node (backend không có catalog firmware)
import { Button, type DataTableColumn } from '@/components/ui'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { HeartbeatTime } from '@/components/features/admin/devices/deviceColumns'
import { t } from '@/i18n'
import type { SensorNode } from '@/types'

// Chỉ node ONLINE mới nhận lệnh từ xa (DEGRADED đã bỏ, SRS 3.1.0)
const canUpdate = (node: SensorNode): boolean => node.status === 'ONLINE'

export function OtaChip({ node }: { node: SensorNode }) {
  if (node.ota_pending) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-climateOrange/15 px-2.5 py-1 text-xs font-semibold text-charcoal">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-climateOrange motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-climateOrange" />
        </span>
        {t('Đang cập nhật · {{version}}', { version: node.ota_pending.version })}
      </span>
    )
  }
  if (node.ota_failed) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-alertRed/10 px-2.5 py-1 text-xs font-semibold text-alertRed">
        <span className="h-1.5 w-1.5 rounded-full bg-alertRed" />
        {t('Lỗi · {{version}}', { version: node.ota_failed.version })}
      </span>
    )
  }
  return <span className="text-warmGray">—</span>
}

// Nút mở ngăn gửi; khoá khi thiết bị không online, có title nêu lý do
export function UpdateButton({ node, onSelect, className }: { node: SensorNode; onSelect: (node: SensorNode) => void; className?: string }) {
  const disabled = !canUpdate(node)
  return (
    <Button
      size="sm"
      variant="secondary"
      className={className}
      disabled={disabled}
      title={disabled ? t('Chỉ thiết bị đang online mới nhận được bản cập nhật') : undefined}
      onClick={event => { event.stopPropagation(); onSelect(node) }}
    >
      Cập nhật
    </Button>
  )
}

/** Width % (table-fixed), tổng 100: 13+17+24+10+16+12+8 */
export function buildOtaColumns(locationOf: (node: SensorNode) => string, onSelect: (node: SensorNode) => void): DataTableColumn<SensorNode>[] {
  return [
    { key: 'status', header: 'Trạng thái', className: 'w-[13%]', render: node => <StatusDot status={node.status} /> },
    {
      key: 'device_id', header: 'Thiết bị', className: 'w-[17%]',
      render: node => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-charcoal" title={node.device_id}>{node.device_id}</span>
          <SimulatedBadge simulated={node.simulated} />
        </div>
      ),
    },
    { key: 'location', header: 'Vị trí', className: 'w-[24%]', render: node => <span className="line-clamp-2 break-words text-graphite">{locationOf(node)}</span> },
    { key: 'firmware', header: 'Firmware', className: 'w-[10%] whitespace-nowrap', render: node => node.firmware_version ?? '—' },
    { key: 'ota', header: 'Cập nhật', className: 'w-[16%]', render: node => <OtaChip node={node} /> },
    { key: 'last_heartbeat', header: 'Kết nối cuối', className: 'w-[12%] whitespace-nowrap', render: node => <HeartbeatTime at={node.last_heartbeat} /> },
    { key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[8%]', render: node => <UpdateButton node={node} onSelect={onSelect} /> },
  ]
}
