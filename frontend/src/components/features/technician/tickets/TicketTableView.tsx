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
  /** Chỉ true khi dữ liệu đã tải toàn bộ (tab Quá hạn SLA) — sort 1 trang server sẽ sai thứ tự giữa các trang */
  sortable: boolean
}

export function TicketTableView({
  records, sortKey, sortDir, page, totalItems,
  onSort, onPage, onUpdateStatus, onReassign, sortable,
}: Props) {
  const sortHeader = (key: SortKey, label: string) => sortable ? (
    <button type="button" className={`inline-flex items-center gap-1 transition-colors hover:text-charcoal ${sortKey === key ? 'text-charcoal' : ''}`} onClick={() => onSort(key)}>
      {label}<SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  ) : label

  return (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed border-collapse text-left" role="table">
          <thead>
            <tr className="border-b border-warmGray/15 bg-warmGray/5">
              <th className="w-[12%] whitespace-nowrap py-3 pl-5 pr-3 label-caption text-left">
                Ưu tiên
              </th>
              <th className="w-[22%] whitespace-nowrap py-3 pr-3 label-caption text-left">
                Loại ticket
              </th>
              <th className="w-[20%] whitespace-nowrap py-3 pr-3 label-caption text-left">
                {sortHeader('status', 'Trạng thái')}
              </th>
              <th className="w-[20%] whitespace-nowrap py-3 pr-3 label-caption text-left">
                {sortHeader('sla', 'Thời hạn SLA')}
              </th>
              <th className="w-[14%] whitespace-nowrap py-3 pr-3 label-caption text-left">
                {sortHeader('created_at', 'Ngày tạo')}
              </th>
              <th className="w-[12%] py-3 pr-5 label-caption text-center">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmGray/10">
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

      <div className="border-t border-warmGray/10 px-5 pb-4 pt-1">
        <Pagination
          page={page}
          total={totalItems}
          limit={PAGE_SIZE}
          onChange={onPage}
          variant="full"
        />
      </div>
    </div>
  )
}
