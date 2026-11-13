import type { ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { t, tr } from '@/i18n'

interface ConfirmModalProps {
  open: boolean
  title: string
  /** Chữ (tự dịch qua tr) hoặc nội dung đã dịch sẵn có định dạng (VD cụm in đậm) — truyền nguyên */
  description?: ReactNode
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
    // Bấm ra ngoài = Hủy; đang xử lý thì không (như nút Hủy bị khoá)
    <Modal open={open} onClose={onCancel} title={title} closeOnBackdrop={!loading}>
      {description && <p className="mb-6 text-sm text-warmGray">{typeof description === 'string' ? tr(description) : description}</p>}
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
