import { Button } from '@/components/ui'
import { IconEdit } from '@/components/ui/icons'
import { t } from '@/i18n'

/**
 * Đầu card cấu hình (ngưỡng mặc định / SLA): tiêu đề + nhãn "Mặc định gốc / Đã tuỳ chỉnh" + mô tả, nút "Chỉnh sửa"
 * bên phải — cùng kiểu tiêu đề card "Chỉ số vận hành toàn hệ thống" (Tổng quan), màu trung tính.
 */
export default function SettingsCardHeader({ title, description, isDefault, onEdit, editLabel }: {
  title: string
  description: string
  /** undefined = chưa tải xong → ẩn nhãn + nút */
  isDefault: boolean | undefined
  onEdit: () => void
  editLabel: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h2 text-charcoal">{t(title)}</h2>
          {isDefault !== undefined && (
            <span
              title={isDefault ? undefined : t('Khác với mặc định kỹ thuật gốc')}
              className="rounded-full bg-warmGray/10 px-2.5 py-0.5 text-xs font-semibold text-graphite"
            >
              {t(isDefault ? 'Mặc định gốc' : 'Đã tuỳ chỉnh')}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-warmGray">{t(description)}</p>
      </div>
      {isDefault !== undefined && (
        // Nền đen chữ trắng (primary) — hành động chính của card, nổi hơn nút viền
        <Button type="button" variant="primary" size="sm" className="shrink-0" aria-label={t(editLabel)} onClick={onEdit}>
          <IconEdit width={16} height={16} />
          Chỉnh sửa
        </Button>
      )}
    </div>
  )
}
