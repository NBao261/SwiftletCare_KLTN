// TicketTableView.tsx — Khối bảng table hoàn chỉnh (thead + tbody + Pagination)
// Trách nhiệm: render table view; không giữ state, nhận tất cả data qua props.
import Pagination from '@/components/ui/Pagination'
import { TicketTableRow, SortIcon } from './TicketTableRow'
import type { Ticket } from '@/types'
import type { SortKey, SortDir } from './ticketListTypes'
import { PAGE_SIZE } from './ticketListTypes'

interface Props {
  records: Ticket[]
  sortKey: SortKey
  sortDir: SortDir
  page: number
  totalItems: number
  onSort: (key: SortKey) => void
  onPage: (p: number) => void
  onUpdateStatus: (t: Ticket) => void
  onReassign: (t: Ticket) => void
}

export function TicketTableView({
  records, sortKey, sortDir, page, totalItems,
  onSort, onPage, onUpdateStatus, onReassign,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left" role="table">
          <thead>
            <tr className="border-b border-graphite/10 bg-graphite/[0.03]">
              <th
                className="cursor-pointer whitespace-nowrap py-3 pl-5 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                onClick={() => onSort('priority')}
              >
                Ưu tiên<SortIcon active={sortKey === 'priority'} dir={sortDir} />
              </th>
              <th className="whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                Loại ticket
              </th>
              <th
                className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                onClick={() => onSort('status')}
              >
                Trạng thái<SortIcon active={sortKey === 'status'} dir={sortDir} />
              </th>
              <th
                className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                onClick={() => onSort('sla')}
              >
                Thời hạn SLA<SortIcon active={sortKey === 'sla'} dir={sortDir} />
              </th>
              <th
                className="cursor-pointer whitespace-nowrap py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray hover:text-charcoal"
                onClick={() => onSort('created_at')}
              >
                Ngày tạo<SortIcon active={sortKey === 'created_at'} dir={sortDir} />
              </th>
              <th className="py-3 pr-3 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                Ghi chú gần nhất
              </th>
              <th className="py-3 pr-5 text-[11px] font-semibold uppercase tracking-wider text-warmGray">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/[0.06]">
            {records.map((ticket, i) => (
              <TicketTableRow
                key={ticket._id}
                ticket={ticket}
                index={i}
                onUpdateStatus={onUpdateStatus}
                onReassign={onReassign}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={totalItems}
        limit={PAGE_SIZE}
        onChange={onPage}
        variant="numbered"
      />
    </div>
  )
}
