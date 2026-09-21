import { useSetUserStatus } from '@/hooks/useUsers'
import ConfirmModal from '@/components/common/ConfirmModal'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import type { User } from '@/types'

/** AUTH-FR-011 — PUT /admin/users/:id/status {is_active:true}; không cần lý do. */
export default function UnlockUserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const setStatus = useSetUserStatus()
  const push = useToastStore(s => s.push)

  return (
    <ConfirmModal
      open={!!user}
      title={`Mở khoá tài khoản — ${user?.full_name ?? ''}`}
      description="Tài khoản sẽ có thể đăng nhập lại bình thường."
      confirmLabel="Mở khoá"
      loading={setStatus.isPending}
      onConfirm={() => {
        if (!user) return
        setStatus.mutate({ id: user._id, isActive: true }, {
          onSuccess: () => { push('Đã mở khoá tài khoản'); onClose() },
          onError: (err) => push(getApiErrorMessage(err, 'Mở khoá thất bại'), 'error'),
        })
      }}
      onCancel={onClose}
    />
  )
}
