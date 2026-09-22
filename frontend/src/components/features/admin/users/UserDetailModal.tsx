import { Modal } from '@/components/ui'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate } from '@/lib/helpers'
import { STATUS_LABEL, ROLE_LABEL } from '@/components/features/admin/users/users.constants'
import type { User } from '@/types'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-warmGray/10 pb-2 last:border-b-0 last:pb-0">
      <span className="text-warmGray">{label}</span>
      <span className="text-right font-medium text-charcoal">{value}</span>
    </div>
  )
}

export default function UserDetailModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const status = user ? getUserStatus(user) : null
  return (
    <Modal open={!!user} onClose={onClose} title="Chi tiết tài khoản">
      {user && status && (
        <div className="flex flex-col gap-3 text-body">
          <DetailRow label="Họ tên" value={user.full_name} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Số điện thoại" value={user.phone || '—'} />
          <DetailRow label="Vai trò" value={ROLE_LABEL[user.role]} />
          <DetailRow label="Trạng thái" value={STATUS_LABEL[status]} />
          {!!user.assigned_regions?.length && <DetailRow label="Vùng phụ trách" value={user.assigned_regions.join(', ')} />}
          {status === 'LOCKED' && user.deactivated_reason && <DetailRow label="Lý do khoá" value={user.deactivated_reason} />}
          {status === 'LOCKED' && user.deactivated_at && <DetailRow label="Khoá lúc" value={formatDate(user.deactivated_at)} />}
          {user.deletion_requested_at && <DetailRow label="Yêu cầu xoá lúc" value={formatDate(user.deletion_requested_at)} />}
          {user.deleted_at && <DetailRow label="Đã xoá lúc" value={formatDate(user.deleted_at)} />}
          <DetailRow label="Ngày tạo" value={user.created_at ? formatDate(user.created_at) : '—'} />
        </div>
      )}
    </Modal>
  )
}
