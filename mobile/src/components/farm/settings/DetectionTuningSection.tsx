import { WaveformIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import { useExpertReviewNote } from '@/hooks/farm/useExpertReviewNote'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateDetectionTuning } from '@/hooks/farm/useUpdateDetectionTuning'
import { useAuthStore } from '@/stores/authStore'
import type { DetectionTuning, Zone } from '@/types'
import { getDetectionTuningLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, joinFooterNotes, withExpertReviewMessage } from '@/utils/settingsSection.utils'
import { DETECTION_TUNING_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const DETECTION_KEYS = Object.keys(DETECTION_TUNING_RULES) as (keyof DetectionTuning)[]

interface DetectionTuningSectionProps {
  zone: Zone
  // Farm của nhà chứa zone, để biết farm có chuyên gia không (BR-22)
  farmId: string
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Tham số phát hiện" của một zone (EXPERT-FR-008): chuyên gia và chủ trại sửa.
// Farm có chuyên gia thì thay đổi của chủ trại áp ngay và mở mục duyệt cho chuyên gia (BR-22 nhóm A)
export function DetectionTuningSection({ zone, farmId, editor, onSaved }: DetectionTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const canEdit = canPerform(user, 'editDetectionTuning')
  const reviewNote = useExpertReviewNote(farmId)
  const updateDetectionTuning = useUpdateDetectionTuning()
  const showSaved = (message: string) => onSaved(withExpertReviewMessage(message, reviewNote))

  return (
    <NumberTuningSection
      id={getSettingsSectionId('detection', zone._id)}
      icon={WaveformIcon}
      title={t('Tham số phát hiện')}
      subtitle={t('Khi nào báo tiếng ồn lạ, phun sương không hiệu quả, loa hỏng')}
      scopeLabel={zone.name}
      footerNote={canEdit ? joinFooterNotes(t('Lưu xong áp dụng ngay cho khu vực'), reviewNote) : undefined}
      keys={DETECTION_KEYS}
      rules={DETECTION_TUNING_RULES}
      values={zone.detection_tuning}
      getLabel={getDetectionTuningLabel}
      canEdit={canEdit}
      editor={editor}
      save={values => updateDetectionTuning.mutateAsync({ zoneId: zone._id, tuning: values })}
      savedMessage={t('Đã lưu tham số phát hiện')}
      onSaved={showSaved}
    />
  )
}
