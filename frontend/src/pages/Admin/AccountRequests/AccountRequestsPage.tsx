// ADMIN — Yêu cầu tài khoản: xoá tài khoản (AUTH-FR-012, Flow 19) + đề xuất/gỡ Sales Staff (AUTH-FR-005d, Flow 16 bước 1b/1e)
// Gọi API thật qua hooks/useAccountRequests.ts (/admin/delete-requests, /admin/sales-staff-requests).
import { useState } from 'react'
import {
  useDeleteRequestsList, useCompleteDeleteRequest,
  useSalesAssignmentRequestsList, useDecideSalesAssignmentRequest,
} from '@/hooks/useAccountRequests'
import { Button, Card, Badge } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmModal from '@/components/common/ConfirmModal'
import NoteActionModal from '@/components/common/NoteActionModal'
import Pagination from '@/components/common/Pagination'
import { IconUsers } from '@/components/ui/icons'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import type { User, SalesAssignmentRequest } from '@/types'

const DELETE_SLA_DAYS = 30
const PAGE_SIZE = 20

type Tab = 'DELETE' | 'SALES_STAFF'

export default function AccountRequestsPage() {
  const [tab, setTab] = useState<Tab>('DELETE')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="label-caption">Quản trị hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Yêu cầu tài khoản</h1>
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === 'DELETE'} label="Yêu cầu xoá tài khoản" onClick={() => setTab('DELETE')} />
        <TabButton active={tab === 'SALES_STAFF'} label="Đề xuất Sales Staff" onClick={() => setTab('SALES_STAFF')} />
      </div>

      {tab === 'DELETE' ? <DeleteRequestsTab /> : <SalesStaffRequestsTab />}
    </div>
  )
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'}`}
    >
      {label}
    </button>
  )
}

function daysRemaining(requestedAt: string): number {
  const elapsedDays = Math.floor((Date.now() - new Date(requestedAt).getTime()) / (24 * 60 * 60 * 1000))
  return DELETE_SLA_DAYS - elapsedDays
}

/** Đọc details.openTickets từ envelope 409 HAS_OPEN_TICKETS (backend/src/services/admin.service.ts) */
function readOpenTickets(err: unknown): number | null {
  const e = err as { response?: { data?: { error?: { code?: string; details?: { openTickets?: number } } } } }
  const error = e?.response?.data?.error
  return error?.code === 'HAS_OPEN_TICKETS' ? (error.details?.openTickets ?? 0) : null
}

function DeleteRequestsTab() {
  const [page, setPage] = useState(1)
  const { records: requests, total, limit, isLoading } = useDeleteRequestsList({ page, limit: PAGE_SIZE })
  const completeDeleteRequest = useCompleteDeleteRequest()
  const push = useToastStore(s => s.push)
  const [target, setTarget] = useState<User | null>(null)
  /** Backend báo còn ticket mở → hỏi lại lần 2 với force:true (Flow 19 bước 7c) */
  const [forceTarget, setForceTarget] = useState<{ user: User; openTickets: number } | null>(null)

  function complete(user: User, force: boolean) {
    completeDeleteRequest.mutate({ id: user._id, force }, {
      onSuccess: () => { push('Đã xử lý yêu cầu xoá tài khoản'); setTarget(null); setForceTarget(null) },
      onError: (err) => {
        const openTickets = readOpenTickets(err)
        if (openTickets !== null && !force) {
          setTarget(null)
          setForceTarget({ user, openTickets })
          return
        }
        push(getApiErrorMessage(err, 'Xử lý yêu cầu xoá thất bại'), 'error')
      },
    })
  }

  if (isLoading) return <LoadingSkeleton count={2} className="h-24 w-full" />
  if (!requests.length) {
    return (
      <EmptyState
        icon={<IconUsers width={28} height={28} />}
        title="Không có yêu cầu xoá tài khoản nào"
        description="Yêu cầu xoá tài khoản (quyền được xoá dữ liệu — Nghị định 13/2023/NĐ-CP) sẽ xuất hiện ở đây."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map(user => {
        const remaining = user.deletion_requested_at ? daysRemaining(user.deletion_requested_at) : null
        return (
          <Card key={user._id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-charcoal">{user.full_name}</p>
              <p className="truncate text-sm text-warmGray">{user.email}</p>
              {user.deletion_requested_at && (
                <p className="mt-0.5 text-xs text-warmGray">Yêu cầu lúc {formatDate(user.deletion_requested_at)}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {remaining !== null && (
                <Badge tone={remaining <= 7 ? 'critical' : 'warning'}>Còn {remaining} ngày (hạn {DELETE_SLA_DAYS} ngày)</Badge>
              )}
              <Button size="sm" onClick={() => setTarget(user)}>Xử lý</Button>
            </div>
          </Card>
        )
      })}

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <ConfirmModal
        open={!!target}
        title={`Xoá tài khoản — ${target?.full_name ?? ''}`}
        description="Hệ thống sẽ tự động: chuyển quyền sở hữu farm cho thành viên tham gia sớm nhất (nếu còn thành viên khác) hoặc soft-delete farm (nếu không còn ai), gỡ khỏi các farm khác, huỷ các phân công/đề xuất liên quan, rồi ẩn danh thông tin cá nhân. Không thể hoàn tác."
        confirmLabel="Xác nhận xoá"
        danger
        loading={completeDeleteRequest.isPending}
        onConfirm={() => target && complete(target, false)}
        onCancel={() => setTarget(null)}
      />

      <ConfirmModal
        open={!!forceTarget}
        title="Người dùng còn ticket đang mở"
        description={`Còn ${forceTarget?.openTickets ?? 0} ticket đang mở liên quan tới ${forceTarget?.user.full_name ?? ''}. Bạn có thể chờ xử lý xong ticket rồi quay lại, hoặc vẫn xoá ngay (ticket sẽ mất người phụ trách/farm).`}
        confirmLabel="Vẫn xoá"
        danger
        loading={completeDeleteRequest.isPending}
        onConfirm={() => forceTarget && complete(forceTarget.user, true)}
        onCancel={() => setForceTarget(null)}
      />
    </div>
  )
}

const REQUEST_TYPE_LABEL: Record<SalesAssignmentRequest['type'], string> = { ADD: 'Thêm', REMOVE: 'Gỡ' }

function SalesStaffRequestsTab() {
  const [page, setPage] = useState(1)
  const { records: requests, total, limit, isLoading } = useSalesAssignmentRequestsList({ page, limit: PAGE_SIZE })
  const decide = useDecideSalesAssignmentRequest()
  const push = useToastStore(s => s.push)
  const [approveTarget, setApproveTarget] = useState<SalesAssignmentRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SalesAssignmentRequest | null>(null)

  if (isLoading) return <LoadingSkeleton count={2} className="h-24 w-full" />
  if (!requests.length) {
    return (
      <EmptyState
        icon={<IconUsers width={28} height={28} />}
        title="Không có đề xuất Sales Staff nào chờ duyệt"
        description="Farm Owner đề xuất thêm/gỡ Sales Staff sẽ xuất hiện ở đây (AUTH-FR-005b/005d)."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map(req => {
        const isRemoval = req.type === 'REMOVE'
        return (
          <Card key={req._id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={isRemoval ? 'warning' : 'info'}>{REQUEST_TYPE_LABEL[req.type]}</Badge>
                <p className="truncate font-bold text-charcoal">{req.sales_staff_email}</p>
              </div>
              <p className="truncate text-sm text-warmGray">
                Farm: {req.farm_id?.name ?? '—'} · Đề xuất bởi {req.requested_by?.full_name ?? '—'} ({req.requested_by?.email ?? '—'})
              </p>
              <p className="mt-0.5 text-xs text-warmGray">Gửi lúc {formatDate(req.created_at)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRejectTarget(req)}>Từ chối</Button>
              <Button size="sm" onClick={() => setApproveTarget(req)}>Duyệt</Button>
            </div>
          </Card>
        )
      })}

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <ConfirmModal
        open={!!approveTarget}
        title={approveTarget?.type === 'REMOVE' ? 'Duyệt gỡ Sales Staff?' : 'Duyệt đề xuất Sales Staff?'}
        description={approveTarget?.type === 'REMOVE'
          ? `Gỡ ${approveTarget.sales_staff_email} khỏi farm ${approveTarget.farm_id?.name ?? ''}. Đơn hàng/sản phẩm đã tạo vẫn giữ nguyên lịch sử.`
          : `Gán ${approveTarget?.sales_staff_email ?? ''} vào farm ${approveTarget?.farm_id?.name ?? ''}. Nếu email chưa có tài khoản, hệ thống tự tạo và gửi mã đặt lại mật khẩu cho người đó.`}
        confirmLabel="Duyệt"
        loading={decide.isPending}
        onConfirm={() => {
          if (!approveTarget) return
          decide.mutate({ id: approveTarget._id, decision: 'APPROVED' }, {
            onSuccess: () => { push('Đã duyệt đề xuất'); setApproveTarget(null) },
            onError: (err) => push(getApiErrorMessage(err, 'Duyệt thất bại'), 'error'),
          })
        }}
        onCancel={() => setApproveTarget(null)}
      />

      <NoteActionModal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Từ chối đề xuất"
        label="Lý do từ chối"
        placeholder="VD: Email không hợp lệ, đã có Sales Staff phụ trách farm này..."
        submitLabel="Từ chối"
        required
        danger
        loading={decide.isPending}
        onSubmit={(reason) => {
          if (!rejectTarget) return
          decide.mutate({ id: rejectTarget._id, decision: 'REJECTED', reason }, {
            onSuccess: () => { push('Đã từ chối đề xuất'); setRejectTarget(null) },
            onError: (err) => push(getApiErrorMessage(err, 'Từ chối thất bại'), 'error'),
          })
        }}
      />
    </div>
  )
}
