import { WaveformIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateDetectionTuning } from '@/hooks/farm/useUpdateDetectionTuning'
import { useAuthStore } from '@/stores/authStore'
import type { DetectionTuning, Zone } from '@/types'
import { getDetectionTuningLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import { DETECTION_TUNING_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const DETECTION_KEYS = Object.keys(DETECTION_TUNING_RULES) as (keyof DetectionTuning)[]

interface DetectionTuningSectionProps {
  zone: Zone
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Tham số phát hiện" của một zone (EXPERT-FR-008): chỉ chuyên gia sửa, chủ trại xem.
// BR-22 (chủ trại sửa khi farm không có chuyên gia) backend chưa có nên chưa mở cho chủ trại
export function DetectionTuningSection({ zone, editor, onSaved }: DetectionTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const canEdit = canPerform(user, 'editDetectionTuning')
  const updateDetectionTuning = useUpdateDetectionTuning()

  return (
    <NumberTuningSection
      id={getSettingsSectionId('detection', zone._id)}
      icon={WaveformIcon}
      title={t('Tham số phát hiện')}
      subtitle={t('Khi nào báo tiếng ồn lạ, phun sương không hiệu quả, loa hỏng')}
      scopeLabel={zone.name}
      footerNote={
        canEdit ? t('Chỉ chuyên gia sửa được. Lưu xong controller của tầng áp dụng ngay') : t('Do chuyên gia chỉnh')
      }
      keys={DETECTION_KEYS}
      rules={DETECTION_TUNING_RULES}
      values={zone.detection_tuning}
      getLabel={getDetectionTuningLabel}
      canEdit={canEdit}
      editor={editor}
      save={values => updateDetectionTuning.mutateAsync({ zoneId: zone._id, tuning: values })}
      savedMessage={t('Đã lưu tham số phát hiện')}
      onSaved={onSaved}
    />
  )
}
