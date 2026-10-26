import { useSetUserStatus } from '@/hooks/admin/useUsers'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import type { User } from '@/types'

/** AUTH-FR-011 — PUT /admin/users/:id/status {is_active:false, reason}; lý do bắt buộc. */
export default function LockUserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const setStatus = useSetUserStatus()
  const push = useToastStore(s => s.push)

  return (
    <NoteActionModal
      open={!!user}
      onClose={onClose}
      title={`${t('Khoá tài khoản')} · ${user?.full_name ?? ''}`}
      label="Lý do khoá"
      placeholder="VD: Vi phạm điều khoản sử dụng"
      // AUTH-FR-011: authenticate đọc lại is_active mỗi request + Socket.io ngắt kết nối → bị chặn ngay; lý do hiện
      // khi đăng nhập (Flow 19); mở khoá lại được (UnlockUserModal)
      hint="Người dùng bị đăng xuất ngay và sẽ thấy lý do này khi đăng nhập. Có thể mở khoá lại bất cứ lúc nào."
      submitLabel="Khoá tài khoản"
      required
      // Backend chỉ bắt buộc không rỗng; 10 ký tự là ngưỡng UI để lý do đủ nghĩa khi
      // hiện lại cho user lúc đăng nhập bị chặn (Flow 19 bước 4) và trong audit log.
      minLength={10}
      emptyMessage="Hãy nhập lý do khoá"
      danger
      loading={setStatus.isPending}
      onSubmit={(reason) => {
        if (!user) return
        setStatus.mutate({ id: user._id, isActive: false, reason }, {
          onSuccess: () => {
            push('Đã khoá tài khoản')
            onClose()
          },
          onError: (err) => push(getApiErrorMessage(err, 'Khoá tài khoản thất bại'), 'error'),
        })
      }}
    />
  )
}
