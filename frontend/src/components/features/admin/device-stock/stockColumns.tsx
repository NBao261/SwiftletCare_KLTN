import { ActionsMenu, Badge, type ActionsMenuItem, type BadgeTone, type DataTableColumn } from '@/components/ui'
import { formatDateOnly } from '@/lib/helpers'
import { t } from '@/i18n'
import type { ProvisionedDevice, StockStatus } from '@/types'

/** Report 3 §6.16 — trạng thái nhãn */
export const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  IN_STOCK: { label: 'Trong kho', tone: 'info' },
  IN_SERVICE: { label: 'Đang dùng', tone: 'positive' },
  RELEASED: { label: 'Đã gỡ khỏi farm', tone: 'warning' },
  REVOKED: { label: 'Đã thu hồi', tone: 'critical' },
}

export type StockAction = 'rotate-key' | 'rotate-broker' | 'revoke'

/** Cấp lại mã kích hoạt và thu hồi chỉ khi thiết bị không đang dùng ở farm nào (BR-26); thu hồi là trạng thái cuối */
function actionsFor(d: ProvisionedDevice, onAction: (a: StockAction, d: ProvisionedDevice) => void): ActionsMenuItem[] {
  const notInService = d.stock_status === 'IN_STOCK' || d.stock_status === 'RELEASED'
  const items: ActionsMenuItem[] = []
  if (notInService) items.push({ label: t('Cấp lại mã kích hoạt'), onClick: () => onAction('rotate-key', d) })
  if (d.stock_status !== 'REVOKED') items.push({ label: t('Cấp lại mật khẩu broker'), onClick: () => onAction('rotate-broker', d) })
  if (notInService) items.push({ label: t('Thu hồi'), danger: true, onClick: () => onAction('revoke', d) })
  return items
}

function note(d: ProvisionedDevice) {
  if (d.stock_status === 'REVOKED') return d.revoke_reason || '—'
  if (d.claimed_at) return t('Kích hoạt lần đầu {{date}}', { date: formatDateOnly(d.claimed_at) })
  return '—'
}

/** Width % (DataTable table-fixed), tổng 100: 6+14+16+16+14+24+10 — Thiết bị vừa mã dài nhất thường gặp, Loại đủ chỗ nhãn "Bộ điều khiển" */
export function buildStockColumns(
  startIndex: number, onAction: (a: StockAction, d: ProvisionedDevice) => void,
): DataTableColumn<ProvisionedDevice>[] {
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]',
      render: (_d, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'device_id', header: 'Thiết bị', className: 'w-[14%]',
      render: d => <span className="block truncate font-bold text-charcoal" title={d.device_id}>{d.device_id}</span>,
    },
    {
      key: 'kind', header: 'Loại', className: 'w-[16%]',
      render: d => <Badge tone="neutral">{d.kind === 'SENSOR' ? 'Bộ điều khiển' : 'Nút AI'}</Badge>,
    },
    {
      key: 'status', header: 'Trạng thái nhãn', className: 'w-[16%]',
      render: d => <Badge tone={STOCK_STATUS[d.stock_status].tone}>{STOCK_STATUS[d.stock_status].label}</Badge>,
    },
    {
      key: 'created_at', header: 'Ngày nhập', className: 'w-[14%] whitespace-nowrap',
      render: d => <span className="text-charcoal">{formatDateOnly(d.created_at)}</span>,
    },
    {
      key: 'note', header: 'Ghi chú', className: 'w-[24%]',
      render: d => <span className="line-clamp-2 break-words text-warmGray" title={note(d)}>{note(d)}</span>,
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%]',
      render: d => {
        const items = actionsFor(d, onAction)
        return items.length ? <ActionsMenu items={items} /> : <span className="text-warmGray">—</span>
      },
    },
  ]
}
