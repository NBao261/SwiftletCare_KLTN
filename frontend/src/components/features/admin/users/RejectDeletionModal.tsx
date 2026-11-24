import { useRejectDeleteRequest } from '@/hooks/admin/useAccountRequests'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { User } from '@/types'

// PUT /admin/delete-requests/:id/reject {reason}; lý do bắt buộc, gửi lại cho người yêu cầu.
export default function RejectDeletionModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const rejectDeleteRequest = useRejectDeleteRequest()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()

  return (
    <NoteActionModal
      open={!!user}
      onClose={onClose}
      title={`${t('Từ chối yêu cầu xoá')} · ${user?.full_name ?? ''}`}
      label="Lý do từ chối"
      placeholder="VD: Còn nghĩa vụ lưu hồ sơ thu hoạch theo hợp đồng"
      hint="Tài khoản giữ nguyên và rời khỏi danh sách; người yêu cầu nhận thông báo kèm lý do này."
      submitLabel="Từ chối yêu cầu"
      required
      emptyMessage="Nhập lý do từ chối"
      loading={rejectDeleteRequest.isPending}
      onSubmit={(reason) => {
        if (!user) return
        rejectDeleteRequest.mutate({ id: user._id, reason }, {
          onSuccess: () => {
            push('Đã từ chối yêu cầu xoá tài khoản')
            onClose()
          },
          onError: (err) => push(apiErrorMessage(err, t('Từ chối yêu cầu thất bại')), 'error'),
        })
      }}
    />
  )
}
