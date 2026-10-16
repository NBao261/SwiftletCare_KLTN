import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { t, tr } from '@/i18n'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** ConfirmModal – xác nhận hành động phá hủy (xóa farm, gỡ thiết bị...). Chữ truyền vào tự dịch theo VI/EN (tr) */
export default function ConfirmModal({
  open, title, description, confirmLabel = 'Xác nhận', danger, loading, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {description && <p className="mb-6 text-sm text-warmGray">{tr(description)}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
          {t('Hủy')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} className="flex-1" onClick={onConfirm} loading={loading}>
          {tr(confirmLabel)}
        </Button>
      </div>
    </Modal>
  )
}
