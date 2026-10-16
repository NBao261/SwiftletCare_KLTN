import { useState } from 'react'
import { useDefaultThresholds } from '@/hooks/admin/useSystem'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { THRESHOLD_LIMITS } from '@/validations/common/threshold.validation'
import { THRESHOLD_KEYS, FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { THRESHOLD_GROUPS } from '@/components/features/admin/system/system.constants'
import SettingsCardHeader from '@/components/features/admin/system/SettingsCardHeader'
import ThresholdsEditModal from '@/components/features/admin/system/ThresholdsEditModal'

const ICON = 'bg-warmGray/10 text-charcoal'

/**
 * Ngưỡng môi trường mặc định (SYSTEM-FR-002) — nguồn cho "Reset về mặc định" (ENV-FR-020) và ngưỡng khởi tạo phòng mới.
 * Cùng kiểu card "Chỉ số vận hành toàn hệ thống": card trắng + 5 ô StatTile (icon xám). Chỉ ĐỌC — "Chỉnh sửa" mở
 * ThresholdsEditModal.
 */
export default function ThresholdsCard() {
  const { data, isLoading, error } = useDefaultThresholds()
  const [isEditing, setIsEditing] = useState(false)
  const isDefault = data ? THRESHOLD_KEYS.every(k => data[k] === FACTORY_DEFAULT_THRESHOLDS[k]) : undefined

  return (
    <>
      <Card className="flex flex-col gap-4">
        <SettingsCardHeader
          title="Ngưỡng môi trường mặc định"
          description="Áp dụng khi tạo phòng mới và khi Farm Owner bấm “Reset về mặc định”."
          isDefault={isDefault}
          onEdit={() => setIsEditing(true)}
          editLabel="Chỉnh sửa ngưỡng môi trường mặc định"
        />

        {isLoading && <LoadingSkeleton count={1} className="h-24 w-full" />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-sm text-warmGray">
            {t('Không tải được ngưỡng mặc định')} — {t(getApiErrorMessage(error, 'thử tải lại trang.'))}
          </p>
        )}

        {data && (
          // 5 ô bằng nhau trên desktop; mobile 2 cột
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {THRESHOLD_GROUPS.map(g => g.kind === 'range' ? (
              <StatTile
                key={g.label}
                className="shadow-none"
                icon={g.icon}
                iconClass={ICON}
                label={g.label}
                value={`${data[g.minKey]} – ${data[g.maxKey]} ${THRESHOLD_LIMITS[g.minKey].unit}`}
                sub="Khoảng an toàn"
              />
            ) : (
              <StatTile
                key={g.label}
                className="shadow-none"
                icon={g.icon}
                iconClass={ICON}
                label={g.label}
                value={`${data[g.key]} ${THRESHOLD_LIMITS[g.key].unit}`}
                sub="Tối đa cho phép"
              />
            ))}
          </div>
        )}
      </Card>

      <ThresholdsEditModal open={isEditing} onClose={() => setIsEditing(false)} />
    </>
  )
}
