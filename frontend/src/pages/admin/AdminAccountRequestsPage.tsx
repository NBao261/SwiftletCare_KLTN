// ADMIN: Yêu cầu tài khoản: xoá tài khoản, API thật /admin/delete-requests.
import { useState, useEffect } from 'react'
import RejectDeletionModal from '@/components/features/admin/users/RejectDeletionModal'
import { useDeleteRequestsList, useCompleteDeleteRequest } from '@/hooks/admin/useAccountRequests'
import { Button, Badge, SectionCard } from '@/components/ui'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useToastStore } from '@/stores/toastStore'
import { formatRelativeTime, getApiErrorMessage } from '@/lib/helpers'
// `t` là biến lặp TABS trong file này: hàm dịch đặt tên khác
import { t as i18nT, tr } from '@/i18n'
import type { User } from '@/types'

const DELETE_DEADLINE_DAYS = 30
// DataTable cố định 10 dòng; 64px vừa ô thời gian 2 dòng
const PAGE_SIZE = 10
const ROW_HEIGHT = 64
const FRAME = 'flex flex-col gap-3'

const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

// Ô thời gian 2 dòng: "3 ngày trước" đậm trên, ngày xám dưới
function TimeCell({ at }: { at?: string }) {
  if (!at) return <span className="text-warmGray">—</span>
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-charcoal">{formatRelativeTime(at)}</span>
      <span className="text-small text-warmGray">{DAY.format(new Date(at))}</span>
    </div>
  )
}


// Xử lý xong mục cuối của trang thì lùi về trang cuối còn dữ liệu
function useClampedPage(page: number, setPage: (page: number) => void, total: number, limit: number, isLoading: boolean): boolean {
  const lastPage = Math.max(1, Math.ceil(total / limit))
  const beyondLastPage = !isLoading && page > lastPage
  useEffect(() => {
    if (beyondLastPage) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])
  return beyondLastPage
}

// Tab "Yêu cầu xoá tài khoản" của mục Người dùng: tên ở header và tab nên card chỉ còn dòng mô tả
export default function AdminAccountRequestsPage() {
  return (
    <SectionCard
      description={tr(`Người dùng xin xoá tài khoản, xử lý trong ${DELETE_DEADLINE_DAYS} ngày`)}
    >
      <DeleteRequestsTab />
    </SectionCard>
  )
}

function daysRemaining(requestedAt: string): number {
  const elapsedDays = Math.floor((Date.now() - new Date(requestedAt).getTime()) / (24 * 60 * 60 * 1000))
  return DELETE_DEADLINE_DAYS - elapsedDays
}

function DeleteRequestsTab() {
  const [page, setPage] = useState(1)
  const { records: requests, total, limit, isLoading } = useDeleteRequestsList({ page, limit: PAGE_SIZE })
  const clamping = useClampedPage(page, setPage, total, limit, isLoading)
  const completeDeleteRequest = useCompleteDeleteRequest()
  const push = useToastStore(s => s.push)
  const [target, setTarget] = useState<User | null>(null)
  const [rejectTarget, setRejectTarget] = useState<User | null>(null)

  function complete(user: User) {
    completeDeleteRequest.mutate(user._id, {
      onSuccess: () => { push('Đã xử lý yêu cầu xoá tài khoản'); setTarget(null) },
      onError: (err) => push(getApiErrorMessage(err, 'Xử lý yêu cầu xoá thất bại'), 'error'),
    })
  }

  if (isLoading || clamping) return <div className={FRAME}><LoadingSkeleton count={5} className="h-14 w-full" /></div>

  // Người dùng (tên và email) · Thời gian yêu cầu · Hạn xử lý (còn N ngày) · Thao tác: tổng 36+18+18+28 = 100
  const columns: DataTableColumn<User>[] = [
    {
      key: 'name', header: 'Người dùng', className: 'w-[36%]',
      render: u => (
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-semibold text-charcoal" title={u.full_name}>{u.full_name}</p>
          <p className="truncate text-small text-warmGray" title={u.email}>{u.email}</p>
        </div>
      ),
    },
    { key: 'requested', header: 'Thời gian yêu cầu', className: 'w-[18%] whitespace-nowrap', render: u => <TimeCell at={u.deletion_requested_at ?? undefined} /> },
    {
      key: 'deadline', header: 'Hạn xử lý', className: 'w-[18%]',
      render: u => {
        const remaining = u.deletion_requested_at ? daysRemaining(u.deletion_requested_at) : null
        return remaining === null
          ? <span className="text-warmGray">—</span>
          : <Badge tone={remaining <= 7 ? 'critical' : 'warning'} className="whitespace-nowrap">{i18nT('Còn {{n}} ngày', { n: remaining })}</Badge>
      },
    },
    {
      key: 'actions', header: '', align: 'right', className: 'w-[28%]',
      // Admin hoàn tất hoặc từ chối
      render: u => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => setTarget(u)}>Xử lý</Button>
          <Button size="sm" variant="secondary" onClick={() => setRejectTarget(u)}>Từ chối</Button>
        </div>
      ),
    },
  ]

  return (
    <div className={FRAME}>
      <DataTable
        columns={columns}
        rows={requests}
        getRowKey={u => u._id}
        rowHeight={ROW_HEIGHT}
        minRows={total > limit ? PAGE_SIZE : 0}
        emptyMessage="Chưa có yêu cầu xoá tài khoản nào. Yêu cầu theo Nghị định 13/2023/NĐ-CP sẽ hiện ở đây."
        mobileCard={user => {
          const remaining = user.deletion_requested_at ? daysRemaining(user.deletion_requested_at) : null
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-body font-semibold text-charcoal">{user.full_name}</p>
                  <p className="truncate text-small text-warmGray">{user.email}</p>
                  {user.deletion_requested_at && (
                    <p className="text-small text-warmGray">{i18nT('Yêu cầu {{time}}', { time: formatRelativeTime(user.deletion_requested_at) })}</p>
                  )}
                </div>
                {remaining !== null && (
                  <Badge tone={remaining <= 7 ? 'critical' : 'warning'} className="whitespace-nowrap">{i18nT('Còn {{n}} ngày', { n: remaining })}</Badge>
                )}
              </div>
              {/* Nút của cột Thao tác: Xử lý, Từ chối */}
              {columns[columns.length - 1].render(user, 0)}
            </div>
          )
        }}
      />

      {/* Pagination tự ẩn khi chỉ 1 trang: không giữ chỗ trống dưới bảng */}
      <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />

      <ConfirmModal
        open={!!target}
        title={`${i18nT('Xoá tài khoản')} · ${target?.full_name ?? ''}`}
        description="Quyền sở hữu trang trại chuyển cho thành viên vào sớm nhất; không còn ai thì trang trại bị ẩn. Tài khoản rời các trang trại khác, các phân công và đề xuất liên quan bị huỷ, thông tin cá nhân được xoá danh tính. Không hoàn tác được."
        confirmLabel="Xác nhận xoá"
        danger
        loading={completeDeleteRequest.isPending}
        onConfirm={() => target && complete(target)}
        onCancel={() => setTarget(null)}
      />

      <RejectDeletionModal user={rejectTarget} onClose={() => setRejectTarget(null)} />

    </div>
  )
}

