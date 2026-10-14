// ADMIN — Yêu cầu tài khoản: xoá tài khoản (AUTH-FR-012, Flow 19) + đề xuất/gỡ Sales Staff (AUTH-FR-005d, Flow 16 bước 1b/1e)
// Gọi API thật qua hooks/useAccountRequests.ts (/admin/delete-requests, /admin/sales-staff-requests).
import { useState, useEffect } from 'react'
import {
  useDeleteRequestsList, useCompleteDeleteRequest,
  useSalesAssignmentRequestsList, useDecideSalesAssignmentRequest,
} from '@/hooks/admin/useAccountRequests'
import { Button, Badge, SectionCard } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import NoteActionModal from '@/components/ui/NoteActionModal'
import Pagination from '@/components/ui/Pagination'
import { useToastStore } from '@/stores/toastStore'
import { formatDayTime, getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
// `t` là biến lặp TABS trong file này — hàm dịch đặt tên khác
import { t as i18nT, tr } from '@/i18n'
import type { User, SalesAssignmentRequest } from '@/types'

const DELETE_SLA_DAYS = 30
/** Lưới card — cùng kiểu card nhà yến ở chi tiết Farm (viền + bóng như StatTile); nút luôn ở đáy card */
const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
/** Card gọn: hàng cuối gộp thông tin + nút (không để nút 1 hàng riêng) — h-40 vừa card đề xuất (4 hàng) */
const CARD = 'flex h-40 flex-col gap-2 rounded-2xl border border-warmGray/15 bg-white p-4 shadow-card'
/** Khung cố định: 3 hàng card h-40 (+2 khoảng gap-4) + hàng phân trang + dòng ghi chú — trống/đang tải/ít card vẫn giữ cỡ */
const FRAME_MIN_H = 'min-h-[37rem]'
const FRAME = `flex ${FRAME_MIN_H} flex-col gap-3`
/** 9 = 3 hàng × 3 card (màn lớn) — khung cố định vừa đủ 3 hàng + 1 hàng phân trang */
const PAGE_SIZE = 9

type Tab = 'DELETE' | 'SALES_STAFF'

// ── FAKE DATA — CHỈ ĐỂ XEM GIAO DIỆN ──────────────────────────────────────────────────────────────────────────────
// Trang này ĐÃ có API thật; dữ liệu giả dưới đây chỉ hiện khi danh sách thật TRỐNG, kèm dòng "This data is FAKE…"
// (FE_Design §5.4) và khoá mọi nút (không gọi API với id giả). Đặt SHOW_FAKE_PREVIEW = false (hoặc xoá khối này)
// trước khi nộp/demo thật — FE_Design §13.9 cấm để dữ liệu giả ở màn đã có API.
const SHOW_FAKE_PREVIEW = true
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
// 11 + 11 mục giả = 2 trang mỗi tab (9 + 2) — để thấy cả lưới đầy 3 hàng lẫn thanh phân trang
const FAKE_DELETE_REQUESTS = ([
  ['Nguyễn Văn Bình', 'binh.nguyen', 26], ['Trần Thị Mai', 'mai.tran', 24], ['Lê Hoàng Phúc', 'phuc.le', 21],
  ['Phạm Thu Hà', 'ha.pham', 18], ['Võ Minh Tuấn', 'tuan.vo', 15], ['Đặng Ngọc Lan', 'lan.dang', 12],
  ['Bùi Quang Huy', 'huy.bui', 9], ['Hồ Thị Thanh', 'thanh.ho', 6], ['Ngô Đức Anh', 'anh.ngo', 4],
  ['Dương Bảo Ngọc', 'ngoc.duong', 2], ['Lý Gia Khang', 'khang.ly', 0],
] as const).map(([full_name, mail, days], i) => ({
  _id: `fake-del-${i + 1}`, full_name, email: `${mail}@example.com`, deletion_requested_at: daysAgo(days),
})) as unknown as User[]
const FAKE_FARMS = ['Trại Yến Demo', 'Trại Yến Cần Giờ', 'Trại Yến Long An', 'Trại Yến Bình Thuận']
const FAKE_OWNERS = [
  { _id: 'fake-owner-1', full_name: 'Demo Farm Owner', email: 'owner@swiftletcare.dev' },
  { _id: 'fake-owner-2', full_name: 'Phạm Quốc Huy', email: 'huy.pham@example.com' },
  { _id: 'fake-owner-3', full_name: 'Trương Mỹ Linh', email: 'linh.truong@example.com' },
]
const FAKE_SALES_EMAILS = [
  'chuyenvien.an', 'linh.sales', 'cu.chuyenvien', 'minh.banhang', 'thao.kinhdoanh', 'nam.sales',
  'hoa.chuyenvien', 'khoa.banhang', 'vy.sales', 'tam.kinhdoanh', 'son.chuyenvien',
]
const FAKE_SALES_REQUESTS: SalesAssignmentRequest[] = FAKE_SALES_EMAILS.map((mail, i) => ({
  _id: `fake-sales-${i + 1}`, type: i % 3 === 2 ? 'REMOVE' : 'ADD', status: 'PENDING', created_at: daysAgo(i),
  farm_id: { _id: `fake-farm-${i % FAKE_FARMS.length}`, name: FAKE_FARMS[i % FAKE_FARMS.length] },
  sales_staff_email: `${mail}@example.com`,
  requested_by: FAKE_OWNERS[i % FAKE_OWNERS.length],
}))
/** Dòng công khai dữ liệu giả — đúng câu chữ FE_Design §5.4 */
const FakeNotice = () => <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
// ── HẾT FAKE DATA ──────────────────────────────────────────────────────────────────────────────────────────────────

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
  { key: 'SALES_STAFF', label: 'Đề xuất chuyên viên', description: 'Farm Owner đề xuất thêm hoặc gỡ chuyên viên cho trang trại' },
]

/**
 * Không lặp tiêu đề "Yêu cầu tài khoản" — AppHeader đã hiện tên trang. 1 card (SectionCard) như các trang Admin khác,
 * tab pill ở góc phải cùng kiểu trang Ticket / chi tiết Farm.
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

/** Đọc details.openTickets từ envelope 409 HAS_OPEN_TICKETS (backend/src/services/admin.service.ts) */
function readOpenTickets(err: unknown): number | null {
  const e = err as { response?: { data?: { error?: { code?: string; details?: { openTickets?: number } } } } }
  const error = e?.response?.data?.error
  return error?.code === 'HAS_OPEN_TICKETS' ? (error.details?.openTickets ?? 0) : null
}

function DeleteRequestsTab() {
  const [page, setPage] = useState(1)
  /** FAKE: trang riêng của dữ liệu giả — không dùng page thật vì useClampedPage kéo về 1 khi total thật = 0 */
  const [fakePage, setFakePage] = useState(1)
  const { records: requests, total, limit, isLoading } = useDeleteRequestsList({ page, limit: PAGE_SIZE })
  const clamping = useClampedPage(page, setPage, total, limit, isLoading)
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

  if (isLoading || clamping) return <div className={FRAME}><LoadingSkeleton count={3} className="h-40 w-full" /></div>
  // FAKE: danh sách thật trống → hiện dữ liệu mẫu (nút khoá)
  const isFake = !requests.length && SHOW_FAKE_PREVIEW
  if (!requests.length && !isFake) {
    return (
      <div className={`grid ${FRAME_MIN_H}`}>
      <EmptyState
        title="Không có yêu cầu xoá tài khoản nào"
        description="Yêu cầu xoá tài khoản (quyền được xoá dữ liệu — Nghị định 13/2023/NĐ-CP) sẽ xuất hiện ở đây."
      />
      </div>
    )
  }

  return (
    <div className={FRAME}>
      {isFake && <FakeNotice />}
      <div className={GRID}>
      {(isFake ? FAKE_DELETE_REQUESTS.slice((fakePage - 1) * PAGE_SIZE, fakePage * PAGE_SIZE) : requests).map(user => {
        const remaining = user.deletion_requested_at ? daysRemaining(user.deletion_requested_at) : null
        return (
          <div key={user._id} className={CARD}>
            {/* Hạn 30 ngày đã ghi ở mô tả card — nhãn chỉ còn số ngày còn lại */}
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-bold text-charcoal" title={user.full_name}>{user.full_name}</p>
              {remaining !== null && (
                <Badge tone={remaining <= 7 ? 'critical' : 'warning'} className="shrink-0">{i18nT('Còn {{n}} ngày', { n: remaining })}</Badge>
              )}
            </div>
            <p className="truncate text-sm text-warmGray" title={user.email}>{user.email}</p>
            {/* Hàng cuối: thời gian yêu cầu + nút — gộp 1 hàng cho card gọn */}
            <div className="mt-auto flex items-center justify-between gap-2">
              <p className="truncate text-xs text-warmGray">
                {user.deletion_requested_at && i18nT('Yêu cầu {{date}}', { date: formatDayTime(user.deletion_requested_at) })}
              </p>
              <Button size="sm" className="shrink-0" disabled={isFake} onClick={() => setTarget(user)}>Xử lý</Button>
            </div>
          </div>
        )
      })}
      </div>

      {/* Hàng phân trang luôn chiếm chỗ ở đáy khung (Pagination tự ẩn khi chỉ 1 trang) */}
      <div className="mt-auto min-h-11">
        {isFake
          ? <Pagination page={fakePage} limit={PAGE_SIZE} total={FAKE_DELETE_REQUESTS.length} onChange={setFakePage} variant="full" />
          : <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />}
      </div>

      <ConfirmModal
        open={!!target}
        title={`${i18nT('Xoá tài khoản')} — ${target?.full_name ?? ''}`}
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
        description={i18nT('Còn {{n}} ticket đang mở liên quan tới {{name}}. Bạn có thể chờ xử lý xong ticket rồi quay lại, hoặc vẫn xoá ngay (ticket sẽ mất người phụ trách/farm).', { n: forceTarget?.openTickets ?? 0, name: forceTarget?.user.full_name ?? '' })}
        confirmLabel="Vẫn xoá"
        danger
        loading={completeDeleteRequest.isPending}
        onConfirm={() => forceTarget && complete(forceTarget.user, true)}
        onCancel={() => setForceTarget(null)}
      />
    </div>
  )
}


function SalesStaffRequestsTab() {
  const [page, setPage] = useState(1)
  /** FAKE: trang riêng của dữ liệu giả — không dùng page thật vì useClampedPage kéo về 1 khi total thật = 0 */
  const [fakePage, setFakePage] = useState(1)
  const { records: requests, total, limit, isLoading } = useSalesAssignmentRequestsList({ page, limit: PAGE_SIZE })
  const clamping = useClampedPage(page, setPage, total, limit, isLoading)
  const decide = useDecideSalesAssignmentRequest()
  const push = useToastStore(s => s.push)
  const [approveTarget, setApproveTarget] = useState<SalesAssignmentRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SalesAssignmentRequest | null>(null)

  if (isLoading || clamping) return <div className={FRAME}><LoadingSkeleton count={3} className="h-40 w-full" /></div>
  // FAKE: danh sách thật trống → hiện dữ liệu mẫu (nút khoá)
  const isFake = !requests.length && SHOW_FAKE_PREVIEW
  if (!requests.length && !isFake) {
    return (
      <div className={`grid ${FRAME_MIN_H}`}>
      <EmptyState
        title="Không có đề xuất chuyên viên nào chờ duyệt"
        description="Đề xuất thêm hoặc gỡ chuyên viên của Farm Owner sẽ hiện ở đây."
      />
      </div>
    )
  }

  return (
    <div className={FRAME}>
      {isFake && <FakeNotice />}
      <div className={GRID}>
      {(isFake ? FAKE_SALES_REQUESTS.slice((fakePage - 1) * PAGE_SIZE, fakePage * PAGE_SIZE) : requests).map(req => {
        const isRemoval = req.type === 'REMOVE'
        return (
          <div key={req._id} className={CARD}>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={isRemoval ? 'warning' : 'info'}>{i18nT(isRemoval ? 'Gỡ chuyên viên' : 'Thêm chuyên viên')}</Badge>
              <span className="shrink-0 text-xs text-warmGray">{formatDayTime(req.created_at)}</span>
            </div>
            <p className="truncate font-bold text-charcoal" title={req.sales_staff_email}>{req.sales_staff_email}</p>
            <p className="truncate text-sm"><span className="text-warmGray">{i18nT('Trang trại')}: </span><span className="text-charcoal">{req.farm_id?.name ?? '—'}</span></p>
            {/* Hàng cuối: người đề xuất + 2 nút — gộp 1 hàng cho card gọn */}
            <div className="mt-auto flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm" title={req.requested_by?.email}>
                <span className="text-warmGray">{i18nT('Bởi')} </span><span className="text-charcoal">{req.requested_by?.full_name ?? '—'}</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" disabled={isFake} onClick={() => setRejectTarget(req)}>Từ chối</Button>
                <Button size="sm" disabled={isFake} onClick={() => setApproveTarget(req)}>Duyệt</Button>
              </div>
            </div>
          </div>
        )
      })}
      </div>

      {/* Hàng phân trang luôn chiếm chỗ ở đáy khung (Pagination tự ẩn khi chỉ 1 trang) */}
      <div className="mt-auto min-h-11">
        {isFake
          ? <Pagination page={fakePage} limit={PAGE_SIZE} total={FAKE_SALES_REQUESTS.length} onChange={setFakePage} variant="full" />
          : <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />}
      </div>

      <ConfirmModal
        open={!!approveTarget}
        title={approveTarget?.type === 'REMOVE' ? 'Duyệt gỡ chuyên viên?' : 'Duyệt đề xuất chuyên viên?'}
        description={approveTarget?.type === 'REMOVE'
          ? i18nT('Gỡ {{email}} khỏi farm {{farm}}. Đơn hàng/sản phẩm đã tạo vẫn giữ nguyên lịch sử.', { email: approveTarget.sales_staff_email, farm: approveTarget.farm_id?.name ?? '' })
          : i18nT('Gán {{email}} vào farm {{farm}}. Nếu email chưa có tài khoản, hệ thống tự tạo và gửi mã đặt lại mật khẩu cho người đó.', { email: approveTarget?.sales_staff_email ?? '', farm: approveTarget?.farm_id?.name ?? '' })}
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
        placeholder="VD: Email không hợp lệ, đã có chuyên viên phụ trách farm này..."
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
