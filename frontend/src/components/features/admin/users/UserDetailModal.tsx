import type { ReactNode } from 'react'
import { CalendarBlankIcon, EnvelopeSimpleIcon, LockSimpleIcon, MapPinIcon, PhoneIcon, TrashIcon, type Icon } from '@phosphor-icons/react'
import { Badge, Modal } from '@/components/ui'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate } from '@/lib/helpers'
import { STATUS_LABEL, STATUS_TONE, ROLE_LABEL } from '@/components/features/admin/users/users.constants'
import type { User } from '@/types'

/** 1 hàng thông tin: icon + nhãn bên trái, giá trị đậm căn phải — mắt quét dọc 2 cột thay vì đọc nhãn chồng trên giá trị */
function InfoRow({ icon: RowIcon, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
        <RowIcon size={15} weight="bold" />
      </span>
      <dt className="shrink-0 text-small text-graphite">{label}</dt>
      <dd className="ml-auto min-w-0 break-words text-right text-body font-semibold text-charcoal">{children}</dd>
    </div>
  )
}

/**
 * Popup chi tiết tài khoản (AUTH-FR-011) — mở khi bấm dòng/"Xem chi tiết" ở bảng Người dùng. Trên cùng khối hồ sơ
 * (chữ cái đầu + tên + email + vai trò/trạng thái), rồi khung cảnh báo khi đã khoá/chờ xoá (đọc trước tiên), cuối
 * là thông tin liên hệ + vùng phụ trách (chỉ Technician) + ngày tạo.
 */
export default function UserDetailModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const status = user ? getUserStatus(user) : null
  return (
    <Modal open={!!user} onClose={onClose} title="Chi tiết tài khoản">
      {user && status && (
        <div className="flex flex-col gap-4">
          {/* Hồ sơ */}
          <div className="flex items-center gap-4 rounded-2xl bg-limeMist p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-charcoal text-xl font-extrabold text-limeMist">
              {user.full_name?.[0]?.toUpperCase() ?? 'U'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-charcoal">{user.full_name}</p>
              <p className="truncate text-small text-graphite">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Khối hồ sơ nền lime trùng nền badge positive ("Hoạt động") → nền trắng để 2 nhãn đi cặp, không chìm;
                    tone khác (đỏ/cam/xám) giữ màu riêng để vẫn đọc được trạng thái bằng màu */}
                <Badge className="bg-white">{ROLE_LABEL[user.role]}</Badge>
                <Badge tone={STATUS_TONE[status]} className={STATUS_TONE[status] === 'positive' ? 'bg-white' : undefined}>
                  {STATUS_LABEL[status]}
                </Badge>
              </div>
            </div>
          </div>

          {/* Khoá (AUTH-FR-011) — đỏ; lý do bắt buộc nhập khi khoá nên luôn có để đọc */}
          {status === 'LOCKED' && (
            <div className="flex gap-3 rounded-2xl border border-alertRed/30 bg-red-50 p-4">
              <LockSimpleIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-alertRed" />
              <div className="min-w-0 text-small">
                <p className="font-semibold text-alertRed">
                  Tài khoản đang bị khoá{user.deactivated_at && ` từ ${formatDate(user.deactivated_at)}`}
                </p>
                {user.deactivated_reason && <p className="mt-0.5 break-words text-graphite">Lý do: {user.deactivated_reason}</p>}
              </div>
            </div>
          )}

          {/* Yêu cầu xoá / đã xoá (AUTH-FR-012) — cam; xử lý ở trang Yêu cầu tài khoản */}
          {(user.deletion_requested_at || user.deleted_at) && (
            <div className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <TrashIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-orange-600" />
              <div className="min-w-0 text-small">
                {user.deleted_at
                  ? <p className="font-semibold text-orange-700">Đã xoá lúc {formatDate(user.deleted_at)}</p>
                  : <p className="font-semibold text-orange-700">Chờ xoá — yêu cầu lúc {formatDate(user.deletion_requested_at!)}</p>}
                {!user.deleted_at && <p className="mt-0.5 text-graphite">Xử lý ở trang Yêu cầu tài khoản.</p>}
              </div>
            </div>
          )}

          <dl className="divide-y divide-warmGray/10 rounded-2xl border border-warmGray/15">
            <InfoRow icon={EnvelopeSimpleIcon} label="Email">{user.email}</InfoRow>
            <InfoRow icon={PhoneIcon} label="Số điện thoại">
              {user.phone || <span className="text-warmGray">Chưa cập nhật</span>}
            </InfoRow>
            {user.role === 'TECHNICIAN' && (
              <InfoRow icon={MapPinIcon} label="Vùng phụ trách">
                {user.assigned_regions?.length ? (
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {user.assigned_regions.map(r => <Badge key={r} className="bg-limeMist text-charcoal">{r}</Badge>)}
                  </span>
                ) : (
                  // Chưa gán thì Ticket Router không giao ticket được cho người này (TICKET-FR-004)
                  <span className="font-semibold text-orange-600">Chưa gán — chưa nhận được ticket</span>
                )}
              </InfoRow>
            )}
            <InfoRow icon={CalendarBlankIcon} label="Ngày tạo">{user.created_at ? formatDate(user.created_at) : '—'}</InfoRow>
          </dl>
        </div>
      )}
    </Modal>
  )
}
