// ADMIN — Yêu cầu tài khoản: xoá tài khoản (AUTH-FR-012, Flow 19) — API thật /admin/delete-requests.
// Tab "Đề xuất chuyên gia": backend đã bỏ /admin/sales-staff-requests (SRS v2.0.0 chuyển sang Domain Expert do
// Primary Owner mời) nên hiện ComingSoon, không gọi endpoint thiếu (FE_Design §13.8/13.9).
import { useState, useEffect } from 'react'
import { useDeleteRequestsList, useCompleteDeleteRequest } from '@/hooks/admin/useAccountRequests'
import { Button, Badge, SectionCard } from '@/components/ui'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import ComingSoon from '@/components/ui/ComingSoon'
import Pagination from '@/components/ui/Pagination'
import { useToastStore } from '@/stores/toastStore'
import { formatRelativeTime, getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
// `t` là biến lặp TABS trong file này — hàm dịch đặt tên khác
import { t as i18nT, tr } from '@/i18n'
import type { User } from '@/types'

const DELETE_SLA_DAYS = 30
/**
 * Dạng log như bảng Nhật ký hệ thống: DataTable cố định 10 dòng (dòng trống bù cao bằng dòng thật) + phân trang,
 * mỗi yêu cầu 1 dòng, nút xử lý ở cột Thao tác. 64px vừa ô Thời gian 2 dòng (giờ/ngày)
 */
const PAGE_SIZE = 10
const ROW_HEIGHT = 64
const FRAME = 'flex flex-col gap-3'

const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

/** Ô thời gian 2 dòng — giờ:phút:giây đậm trên, ngày xám dưới (cùng kiểu cột Thời gian Nhật ký hệ thống) */
function TimeCell({ at }: { at?: string }) {
  if (!at) return <span className="text-warmGray">—</span>
  const d = new Date(at)
  return (
    <div className="flex flex-col" title={formatRelativeTime(at)}>
      <span className="font-semibold text-charcoal">{TIME.format(d)}</span>
      <span className="text-small text-warmGray">{DAY.format(d)}</span>
    </div>
  )
}

type Tab = 'DELETE' | 'SALES_STAFF'


/**
 * Xử lý xong mục cuối của trang N (N > 1) thì trang đó trống trong khi các trang trước
 * vẫn còn — kéo `page` lùi về trang cuối còn dữ liệu, thay vì để người dùng kẹt ở
 * trang rỗng (không có Pagination để quay lại). Trả true khi đang ở trang vượt quá.
 */
function useClampedPage(page: number, setPage: (page: number) => void, total: number, limit: number, isLoading: boolean): boolean {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  const beyondLastPage = !isLoading && page > lastPage
  useEffect(() => {
    if (beyondLastPage) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])
  return beyondLastPage
}

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: 'DELETE', label: 'Yêu cầu xoá tài khoản', description: `Người dùng xin xoá tài khoản — xử lý trong ${DELETE_SLA_DAYS} ngày` },
  { key: 'SALES_STAFF', label: 'Đề xuất chuyên gia', description: 'Farm Owner đề xuất thêm hoặc gỡ chuyên gia cho trang trại' },
]

/**
 * Không lặp tiêu đề "Yêu cầu tài khoản" — AppHeader đã hiện tên trang. 1 card (SectionCard) như các trang Admin khác,
 * tab pill ở góc phải cùng kiểu trang Người dùng.
 */
export default function AdminAccountRequestsPage() {
  const [tab, setTab] = useState<Tab>('DELETE')
  const current = TABS.find(t => t.key === tab)!

  return (
    <SectionCard
      title={current.label}
      description={current.description}
      action={
        <div className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={tr('Loại yêu cầu')}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
                tab === t.key ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {tr(t.label)}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'DELETE' ? <DeleteRequestsTab /> : <SalesStaffRequestsTab />}
    </SectionCard>
  )
}

function daysRemaining(requestedAt: string): number {
  const elapsedDays = Math.floor((Date.now() - new Date(requestedAt).getTime()) / (24 * 60 * 60 * 1000))
  return DELETE_SLA_DAYS - elapsedDays
}

function DeleteRequestsTab() {
  const [page, setPage] = useState(1)
  const { records: requests, total, limit, isLoading } = useDeleteRequestsList({ page, limit: PAGE_SIZE })
  const clamping = useClampedPage(page, setPage, total, limit, isLoading)
  const completeDeleteRequest = useCompleteDeleteRequest()
  const push = useToastStore(s => s.push)
  const [target, setTarget] = useState<User | null>(null)

  function complete(user: User) {
    completeDeleteRequest.mutate(user._id, {
      onSuccess: () => { push('Đã xử lý yêu cầu xoá tài khoản'); setTarget(null) },
      onError: (err) => push(getApiErrorMessage(err, 'Xử lý yêu cầu xoá thất bại'), 'error'),
    })
  }

  if (isLoading || clamping) return <div className={FRAME}><LoadingSkeleton count={5} className="h-14 w-full" /></div>
  const startIndex = (page - 1) * PAGE_SIZE

  // STT · Người dùng · Email · Thời gian yêu cầu · Hạn xử lý (còn N ngày) · Thao tác — tổng 6+20+28+16+16+14 = 100
  const columns: DataTableColumn<User>[] = [
    { key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]', render: (_u, i) => <span className="text-warmGray">{startIndex + i + 1}</span> },
    { key: 'name', header: 'Người dùng', className: 'w-[20%]', render: u => <p className="text-fade font-semibold text-charcoal" title={u.full_name}>{u.full_name}</p> },
    { key: 'email', header: 'Email', className: 'w-[28%]', render: u => <p className="truncate text-graphite" title={u.email}>{u.email}</p> },
    { key: 'requested', header: 'Thời gian yêu cầu', className: 'w-[16%] whitespace-nowrap', render: u => <TimeCell at={u.deletion_requested_at} /> },
    {
      key: 'deadline', header: 'Hạn xử lý', className: 'w-[16%]',
      render: u => {
        const remaining = u.deletion_requested_at ? daysRemaining(u.deletion_requested_at) : null
        return remaining === null
          ? <span className="text-warmGray">—</span>
          : <Badge tone={remaining <= 7 ? 'critical' : 'warning'} className="whitespace-nowrap">{i18nT('Còn {{n}} ngày', { n: remaining })}</Badge>
      },
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[14%]',
      render: u => <Button size="sm" onClick={() => setTarget(u)}>Xử lý</Button>,
    },
  ]

  return (
    <div className={FRAME}>
      <DataTable
        columns={columns}
        rows={requests}
        getRowKey={u => u._id}
        rowHeight={ROW_HEIGHT}
        minRows={PAGE_SIZE}
        emptyMessage="Không có yêu cầu xoá tài khoản nào — yêu cầu (quyền được xoá dữ liệu, Nghị định 13/2023/NĐ-CP) sẽ hiện ở đây."
      />

      {/* Hàng phân trang (Pagination tự ẩn khi chỉ 1 trang) */}
      <div className="min-h-11">
        <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />
      </div>

      <ConfirmModal
        open={!!target}
        title={`${i18nT('Xoá tài khoản')} — ${target?.full_name ?? ''}`}
        description="Hệ thống sẽ tự động: chuyển quyền sở hữu farm cho thành viên tham gia sớm nhất (nếu còn thành viên khác) hoặc soft-delete farm (nếu không còn ai), gỡ khỏi các farm khác, huỷ các phân công/đề xuất liên quan, rồi ẩn danh thông tin cá nhân. Không thể hoàn tác."
        confirmLabel="Xác nhận xoá"
        danger
        loading={completeDeleteRequest.isPending}
        onConfirm={() => target && complete(target)}
        onCancel={() => setTarget(null)}
      />

    </div>
  )
}


/**
 * Đề xuất thêm/gỡ chuyên gia: backend đã bỏ /admin/sales-staff-requests (module Sales gỡ ở SRS v1.23.0, v2.0.0 thay bằng
 * Domain Expert do Primary Owner mời — Admin chỉ "I (audit)"). Không gọi endpoint thiếu như thể đã có (FE_Design §13.8/
 * 13.9) — hiện ComingSoon tới khi backend chốt luồng chuyên gia.
 */
function SalesStaffRequestsTab() {
  return (
    <ComingSoon
      title="Sắp ra mắt"
      note="Chưa có API cho đề xuất chuyên gia — luồng đang chuyển sang chuyên gia do chủ nhà yến mời (Domain Expert)."
    />
  )
}
