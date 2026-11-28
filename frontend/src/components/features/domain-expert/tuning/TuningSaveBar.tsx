import { Button } from '@/components/ui'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

interface TuningSaveBarProps {
  // Số ô đang khác bản đã lưu
  changedCount: number
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}

// Nút lưu riêng của mỗi khối tham số: sáng lên khi có thay đổi, xám khi chưa có gì để lưu.
// Chuyên gia lưu là xong; Farm Owner ở farm có chuyên gia thì thay đổi áp dụng ngay và gửi chuyên gia xác nhận
export default function TuningSaveBar({ changedCount, isSaving, onSave, onCancel }: TuningSaveBarProps) {
  const { canEditParameters, ownerNeedsExpert } = useExpertDecisionRights()
  if (!canEditParameters) return null

  const hasChanges = changedCount > 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warmGray/10 pt-4">
      <div className="min-w-0">
        <p className={cn('text-small', hasChanges ? 'font-semibold text-charcoal' : 'text-warmGray')}>
          {hasChanges ? t('{{n}} thay đổi chưa lưu', { n: changedCount }) : t('Chưa có thay đổi')}
        </p>
        {hasChanges && ownerNeedsExpert && <p className="text-small text-warmGray">{t('Áp dụng ngay, chuyên gia sẽ xem lại.')}</p>}
      </div>
      <div className="flex items-center gap-2">
        {hasChanges && <Button variant="secondary" size="sm" disabled={isSaving} onClick={onCancel}>{t('Huỷ')}</Button>}
        <Button variant="accent" size="sm" disabled={!hasChanges} loading={isSaving} onClick={onSave}>
          {ownerNeedsExpert ? t('Gửi chuyên gia xác nhận') : t('Lưu')}
        </Button>
      </div>
    </div>
  )
}
