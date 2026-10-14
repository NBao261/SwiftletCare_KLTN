import { useMemo } from 'react'
import { type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import ActionsMenu from '@/components/ui/ActionsMenu'
import PinButton from '@/components/features/farm-owner/farms/PinButton'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

interface HouseTableProps {
  houses: HouseNode[]
  pinned: Set<string>
  /** false = role không xem được thu hoạch → bỏ cột sản lượng */
  showYield: boolean
  onTogglePin: (houseId: string) => void
  staffByHouse: Record<string, { name: string; initials: string }> | undefined
  onOpen: (node: HouseNode) => void
}

/** Chế độ "Danh sách" của màn Cấu trúc Farm — cùng dữ liệu với lưới card, dựng bằng DataTable dùng chung */
export default function HouseTable({ houses, staffByHouse, pinned, showYield, onTogglePin, onOpen }: HouseTableProps) {
  const { t, num } = useTranslation(farmDict)

  const columns = useMemo<DataTableColumn<HouseNode>[]>(() => {
    const cols: DataTableColumn<HouseNode>[] = [
      {
        key: 'pin', header: t('table.pin'), className: 'w-[5%]',
        render: n => <PinButton pinned={pinned.has(n.house._id)} onToggle={() => onTogglePin(n.house._id)} />,
      },
      {
        key: 'house', header: t('table.house'), className: 'w-[20%]',
        render: n => (
          <div className="min-w-0">
            <p className="truncate font-bold text-charcoal">{n.house.name}</p>
            <p className="truncate text-small text-warmGray">{n.farm.address}</p>
          </div>
        ),
      },
      { key: 'health', header: t('table.status'), className: 'w-[12%]', render: n => <HealthBadge health={n.health} /> },
      { key: 'sensors', header: t('table.sensors'), className: 'w-[10%] whitespace-nowrap', render: n => <span className="text-charcoal">{num(n.sensors)}</span> },
      { key: 'cameras', header: t('table.cameras'), className: 'w-[10%] whitespace-nowrap', render: n => <span className="text-charcoal">{num(n.cameras)}</span> },
      {
        key: 'devices', header: t('table.devices'), className: 'w-[12%] whitespace-nowrap',
        render: n => <span className="text-charcoal">{n.counts.online}/{n.counts.total}</span>,
      },
      {
        key: 'yield', header: t('table.yield'), className: 'w-[12%] whitespace-nowrap',
        render: n => <span className="text-charcoal">{num(n.monthKg, 2)} kg</span>,
      },
      {
        key: 'staff', header: t('card.staff'), className: 'w-[12%]',
        render: n => <span className="truncate text-small text-graphite">{staffByHouse?.[n.house._id]?.name ?? '—'}</span>,
      },
      {
        key: 'actions', header: t('table.actions'), align: 'center', className: 'w-[7%]',
        render: n => (
          // stopPropagation — hàng đã bấm-được (onRowClick), mở menu không được kích hoạt luôn điều hướng
          <div onClick={e => e.stopPropagation()}>
            <ActionsMenu items={[{ label: t('card.open'), onClick: () => onOpen(n) }]} />
          </div>
        ),
      },
    ]
    return showYield ? cols : cols.filter(c => c.key !== 'yield')
  }, [t, num, staffByHouse, pinned, showYield, onTogglePin, onOpen])

  return <FixedRowsTable columns={columns} rows={houses} getRowKey={n => n.house._id} onRowClick={onOpen} rowHeight={68} emptyNotice={t('empty.noMatchTitle')} />
}
