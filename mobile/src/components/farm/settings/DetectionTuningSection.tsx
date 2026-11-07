import { WaveformIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
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
  // Farm của nhà chứa zone, để biết farm có chuyên gia không (BR-22)
  farmId: string
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Tham số phát hiện" của một zone (EXPERT-FR-008): chuyên gia sửa; farm chưa có chuyên gia thì chủ trại sửa thay
// (BR-22), còn lại chủ trại chỉ xem
export function DetectionTuningSection({ zone, farmId, editor, onSaved }: DetectionTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(farmId)
  const canEdit = canPerform(user, 'editDetectionTuning', { farmHasExpert: hasExpert })
  const updateDetectionTuning = useUpdateDetectionTuning()

  return (
    <NumberTuningSection
      id={getSettingsSectionId('detection', zone._id)}
      icon={WaveformIcon}
      title={t('Tham số phát hiện')}
      subtitle={t('Khi nào báo tiếng ồn lạ, phun sương không hiệu quả, loa hỏng')}
      scopeLabel={zone.name}
      footerNote={
        canEdit
          ? hasExpert === false
            ? t('Farm chưa có chuyên gia nên bạn chỉnh thay. Lưu xong controller của khu vực áp dụng ngay')
            : t('Chỉ chuyên gia sửa được. Lưu xong controller của khu vực áp dụng ngay')
          : t('Do chuyên gia chỉnh')
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
