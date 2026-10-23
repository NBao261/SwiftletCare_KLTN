import { useMemo } from 'react'
import { type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import ActionsMenu from '@/components/ui/ActionsMenu'
import PinButton from '@/components/features/farm-owner/farms/PinButton'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { NO_VALUE } from '@/constants/display'

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
        render: node => <PinButton pinned={pinned.has(node.house._id)} onToggle={() => onTogglePin(node.house._id)} />,
      },
      {
        key: 'house', header: t('table.house'), className: 'w-[20%]',
        render: node => (
          <div className="min-w-0">
            <p className="truncate font-bold text-charcoal">{node.house.name}</p>
            <p className="truncate text-small text-warmGray">{node.farm.address}</p>
          </div>
        ),
      },
      { key: 'health', header: t('table.status'), className: 'w-[12%]', render: node => <HealthBadge health={node.health} /> },
      { key: 'sensors', header: t('table.sensors'), className: 'w-[10%] whitespace-nowrap', render: node => <span className="text-charcoal">{num(node.sensors)}</span> },
      { key: 'cameras', header: t('table.cameras'), className: 'w-[10%] whitespace-nowrap', render: node => <span className="text-charcoal">{num(node.cameras)}</span> },
      {
        key: 'devices', header: t('table.devices'), className: 'w-[12%] whitespace-nowrap',
        render: node => <span className="text-charcoal">{node.counts.online}/{node.counts.total}</span>,
      },
      {
        key: 'yield', header: t('table.yield'), className: 'w-[12%] whitespace-nowrap',
        render: node => (node.monthBatches > 0 ? <span className="text-charcoal">{num(node.monthKg, KILOGRAM_DIGITS)} kg</span> : <span className="text-warmGray">{NO_VALUE}</span>),
      },
      {
        key: 'staff', header: t('card.staff'), className: 'w-[12%]',
        render: node => <span className="truncate text-small text-graphite">{staffByHouse?.[node.house._id]?.name ?? NO_VALUE}</span>,
      },
      {
        key: 'actions', header: t('table.actions'), align: 'center', className: 'w-[7%]',
        render: node => (
          // stopPropagation — hàng đã bấm-được (onRowClick), mở menu không được kích hoạt luôn điều hướng
          <div onClick={event => event.stopPropagation()}>
            <ActionsMenu items={[{ label: t('card.open'), onClick: () => onOpen(node) }]} />
          </div>
        ),
      },
    ]
    return showYield ? cols : cols.filter(column => column.key !== 'yield')
  }, [t, num, staffByHouse, pinned, showYield, onTogglePin, onOpen])

  return <FixedRowsTable columns={columns} rows={houses} getRowKey={houseNode => houseNode.house._id} onRowClick={onOpen} rowHeight={68} emptyNotice={t('empty.noMatchTitle')} emptyContent={<TableEmptyState title={t('empty.noMatchTitle')} />} />
}
