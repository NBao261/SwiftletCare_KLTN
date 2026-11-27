import { useState } from 'react'
import { useDefaultThresholds } from '@/hooks/admin/useSystem'
import { Button, SectionCard } from '@/components/ui'
import { IconEdit } from '@/components/ui/icons'
import KpiTile from '@/components/common/KpiTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { formatStandardDate } from '@/lib/i18n'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { THRESHOLD_LIMITS } from '@/validations/common/threshold.validation'
import { THRESHOLD_KEYS, FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { THRESHOLD_GROUPS } from '@/components/features/admin/system/system.constants'
import ThresholdsEditModal from '@/components/features/admin/system/ThresholdsEditModal'

const ICON = 'bg-warmGray/10 text-charcoal'

// Ngưỡng mặc định: dùng khi tạo Zone mới và khi reset; không đổi ngưỡng của Zone đang chạy
export default function ThresholdsCard() {
  const { data, isLoading, error } = useDefaultThresholds()
  const [isEditing, setIsEditing] = useState(false)
  const isDefault = data ? THRESHOLD_KEYS.every(k => data[k] === FACTORY_DEFAULT_THRESHOLDS[k]) : undefined

  return (
    <>
      <SectionCard
        title={
          <>
            {t('Ngưỡng môi trường mặc định')}
            {isDefault !== undefined && (
              <span
                title={isDefault ? undefined : t('Khác với mặc định ban đầu')}
                className="rounded-full bg-warmGray/10 px-2.5 py-0.5 text-xs font-semibold text-graphite"
              >
                {t(isDefault ? 'Mặc định gốc' : 'Đã tuỳ chỉnh')}
              </span>
            )}
          </>
        }
        // ReactNode: chuỗi thường bị cắt một dòng, câu "Không đổi ngưỡng của Zone đang chạy" phải đọc đủ trên điện thoại
        description={<>{t('Dùng cho Zone mới tạo và khi chủ nhà yến đặt lại ngưỡng mặc định. Không đổi ngưỡng của Zone đang chạy.')}</>}
        action={isDefault !== undefined && (
          // Nền đen chữ trắng (primary): hành động chính của card
          <Button type="button" size="sm" className="shrink-0" aria-label={t('Chỉnh sửa ngưỡng môi trường mặc định')} onClick={() => setIsEditing(true)}>
            <IconEdit width={16} height={16} />
            Chỉnh sửa
          </Button>
        )}
      >
        {isLoading && <LoadingSkeleton count={1} className="h-24 w-full" />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-sm text-warmGray">
            {t('Không tải được ngưỡng mặc định')}. {t(getApiErrorMessage(error, 'thử tải lại trang.'))}
          </p>
        )}

        {data && (
          <>
            {/* 5 ô bằng nhau trên desktop; mobile 2 cột. Đã tuỳ chỉnh thì dòng phụ ghi giá trị gốc để so */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {THRESHOLD_GROUPS.map(g => {
                const unit = THRESHOLD_LIMITS[g.kind === 'range' ? g.minKey : g.key].unit
                const current = g.kind === 'range' ? `${data[g.minKey]} – ${data[g.maxKey]}` : `${data[g.key]}`
                const factory = g.kind === 'range'
                  ? `${FACTORY_DEFAULT_THRESHOLDS[g.minKey]} – ${FACTORY_DEFAULT_THRESHOLDS[g.maxKey]}`
                  : `${FACTORY_DEFAULT_THRESHOLDS[g.key]}`
                const changed = current !== factory
                return (
                  <KpiTile
                    key={g.label}
                    className="shadow-none"
                    icon={g.icon}
                    iconClass={ICON}
                    label={g.label}
                    value={`${current} ${unit}`}
                    sub={changed ? t('Gốc: {{value}}', { value: `${factory} ${unit}` }) : g.kind === 'range' ? 'Khoảng an toàn' : 'Tối đa cho phép'}
                  />
                )
              })}
            </div>
            {/* Mỗi lần đổi phải ghi nguồn có mã REF-5: nguồn và lần đổi gần nhất ở đây để khỏi mở hộp sửa mới thấy */}
            <p className="text-small text-warmGray">
              {data.source
                ? t('Nguồn: {{source}}', { source: data.source })
                : t('Chưa đổi lần nào, đang dùng mặc định gốc')}
              {data.updated_at && ` · ${t('Cập nhật {{date}}', { date: formatStandardDate(data.updated_at) })}`}
            </p>
          </>
        )}
      </SectionCard>

      <ThresholdsEditModal open={isEditing} onClose={() => setIsEditing(false)} />
    </>
  )
}
