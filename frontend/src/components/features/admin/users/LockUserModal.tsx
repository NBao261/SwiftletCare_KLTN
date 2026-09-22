import { useSetUserStatus } from '@/hooks/admin/useUsers'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { User } from '@/types'

/** AUTH-FR-011 — PUT /admin/users/:id/status {is_active:false, reason}; lý do bắt buộc. */
export default function LockUserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const setStatus = useSetUserStatus()
  const push = useToastStore(s => s.push)

  return (
    <NoteActionModal
      open={!!user}
      onClose={onClose}
      title={`Khoá tài khoản — ${user?.full_name ?? ''}`}
      label="Lý do khoá"
      placeholder="VD: Đăng tin sai lệch nguồn gốc tổ yến, vi phạm điều khoản Marketplace"
      submitLabel="Khoá tài khoản"
      required
      // Backend chỉ bắt buộc không rỗng; 10 ký tự là ngưỡng UI để lý do đủ nghĩa khi
      // hiện lại cho user lúc đăng nhập bị chặn (Flow 19 bước 4) và trong audit log.
      minLength={10}
      emptyMessage="Chưa nhập lý do — user sẽ thấy lý do này khi đăng nhập bị chặn."
      danger
      loading={setStatus.isPending}
      onSubmit={(reason) => {
        if (!user) return
        setStatus.mutate({ id: user._id, isActive: false, reason }, {
          onSuccess: ({ openTickets }) => {
            // Khoá Technician còn ticket đang giao — backend báo số lượng để Admin gán lại (TICKET-FR-005b)
            push(openTickets
              ? `Đã khoá tài khoản. Còn ${openTickets} ticket đang giao cho người này — cần gán lại kỹ thuật viên.`
              : 'Đã khoá tài khoản')
            onClose()
          },
          onError: (err) => push(getApiErrorMessage(err, 'Khoá tài khoản thất bại'), 'error'),
        })
      }}
    />
  )
}
