import { useMemo } from 'react'
import { CaretRightIcon, WarningIcon } from '@phosphor-icons/react'
import { type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import PinButton from '@/components/features/farm-owner/farms/PinButton'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import { houseReasonText } from '@/components/features/farm-owner/farms/houseHeadline'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'
import { KILOGRAM_DIGITS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { NO_VALUE } from '@/constants/display'
import type { HouseStaff } from '@/hooks/farm-owner/useFarmStructure'
import { cn } from '@/lib/cn'

// Mỗi hàng hai dòng chữ nhiều nhất (tên + số Zone)
const ROW_HEIGHT = 64

interface HouseTableProps {
  houses: HouseNode[]
  pinned: Set<string>
  // false = role không xem được thu hoạch → bỏ cột sản lượng
  showYield: boolean
  onTogglePin: (houseId: string) => void
  staffByHouse: Map<string, HouseStaff>
  onOpen: (node: HouseNode) => void
}

// Tình trạng 1 dòng: biểu tượng + chữ, có sự cố thì chữ là lý do cụ thể (không dựa vào màu một mình)
function HouseStatus({ node }: { node: HouseNode }) {
  const { t, num } = useTranslation(farmDict)
  if (node.health === 'ALERT') {
    const reason = houseReasonText(node, t, num) || t('health.alert')
    return (
      <span title={reason} className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-orange-800">
        <WarningIcon size={16} weight="fill" className="shrink-0" />
        <span className="truncate">{reason}</span>
      </span>
    )
  }
  const isEmpty = node.health === 'EMPTY'
  return (
    <span className={cn('flex items-center gap-1.5 text-sm', isEmpty ? 'text-warmGray' : 'font-semibold text-charcoal')}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', isEmpty ? 'bg-warmGray/40' : 'bg-accent-600')} />
      {t(isEmpty ? 'health.empty' : 'health.normal')}
    </span>
  )
}

// Bảng nhà yến của 1 trang trại: mỗi nhà một hàng, tình trạng kèm lý do, bấm cả hàng để mở chi tiết nhà
export default function HouseTable({ houses, staffByHouse, pinned, showYield, onTogglePin, onOpen }: HouseTableProps) {
  const { t, num } = useTranslation(farmDict)

  const columns = useMemo<DataTableColumn<HouseNode>[]>(() => {
    const cols: DataTableColumn<HouseNode>[] = [
      {
        key: 'house', header: t('table.house'), className: 'w-[20%]',
        render: node => (
          <div className="flex min-w-0 items-center gap-1">
            <PinButton pinned={pinned.has(node.house._id)} onToggle={() => onTogglePin(node.house._id)} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-charcoal">{node.house.name}</p>
              <p className="truncate text-xs text-warmGray">{t('card.zones', { n: node.zones.length })}</p>
            </div>
          </div>
        ),
      },
      // Một dòng: nhà bình thường ghi "Bình thường"; nhà có sự cố ghi thẳng lý do (vượt ngưỡng, cảnh báo, mất kết nối)
      {
        key: 'health', header: t('table.status'), className: 'w-[30%]',
        render: node => <HouseStatus node={node} />,
      },
      {
        key: 'devices', header: t('table.devices'), className: 'w-[14%] whitespace-nowrap',
        render: node => {
          const isEmpty = node.counts.total === 0
          return (
            <span className={cn('text-sm font-semibold', isEmpty ? 'text-warmGray' : node.counts.online < node.counts.total ? 'text-climateOrange' : 'text-charcoal')}>
              {isEmpty ? NO_VALUE : `${num(node.counts.online)}/${num(node.counts.total)}`}
            </span>
          )
        },
      },
      {
        key: 'yield', header: t('table.yield'), className: 'w-[13%] whitespace-nowrap',
        render: node => (node.monthBatches > 0 ? <span className="text-sm text-charcoal">{num(node.monthKg, KILOGRAM_DIGITS)} kg</span> : <span className="text-warmGray">{NO_VALUE}</span>),
      },
      {
        key: 'staff', header: t('card.staff'), className: 'w-[14%]',
        render: node => {
          const staff = staffByHouse.get(node.house._id)
          return staff
            ? <span title={staff.name} className="block truncate text-sm text-charcoal">{staff.name}</span>
            : <span className="block truncate text-xs italic text-warmGray">{t('card.noStaff')}</span>
        },
      },
      {
        key: 'actions', header: '', align: 'right', className: 'w-[4%]',
        render: () => <CaretRightIcon size={16} weight="bold" aria-hidden className="ml-auto text-warmGray" />,
      },
    ]
    return showYield ? cols : cols.filter(column => column.key !== 'yield')
  }, [t, num, staffByHouse, pinned, showYield, onTogglePin])

  return (
    <FixedRowsTable
      columns={columns}
      rows={houses}
      getRowKey={houseNode => houseNode.house._id}
      onRowClick={onOpen}
      rowHeight={ROW_HEIGHT}
      emptyNotice={t('empty.noMatchTitle')}
      emptyContent={<TableEmptyState title={t('empty.noMatchTitle')} />}
      mobileCard={node => {
        const reason = houseReasonText(node, t, num)
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-body font-semibold text-charcoal">{node.house.name}</p>
              <HealthBadge health={node.health} />
            </div>
            {reason && <p className="text-small text-warmGray">{reason}</p>}
            <p className="text-small text-warmGray">
              {t('card.zones', { n: node.zones.length })} · {t('card.devicesOnline', { online: num(node.counts.online), total: num(node.counts.total) })}
            </p>
          </div>
        )
      }}
    />
  )
}
