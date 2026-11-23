import { BirdIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import { useExpertReviewNote } from '@/hooks/farm/useExpertReviewNote'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateBirdCountTuning } from '@/hooks/farm/useUpdateBirdCountTuning'
import { useAuthStore } from '@/stores/authStore'
import type { BirdCountTuning, House } from '@/types'
import { getBirdCountTuningLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, joinFooterNotes, withExpertReviewMessage } from '@/utils/settingsSection.utils'
import { BIRD_COUNT_TUNING_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const BIRD_COUNT_KEYS = Object.keys(BIRD_COUNT_TUNING_RULES) as (keyof BirdCountTuning)[]

interface BirdCountTuningSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Mức giảm tỷ lệ về tổ" của cả nhà (EXPERT-FR-008): giảm quá mức này so với kỳ trước thì báo LOW_RETURN_RATE. Chuyên gia và
// chủ trại sửa. Farm có chuyên gia thì thay đổi của chủ trại áp ngay và mở mục duyệt (BR-22)
export function BirdCountTuningSection({ house, editor, onSaved }: BirdCountTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const canEdit = canPerform(user, 'editBirdCountTuning')
  const reviewNote = useExpertReviewNote(house.farm_id)
  const updateBirdCountTuning = useUpdateBirdCountTuning()
  const showSaved = (message: string) => onSaved(withExpertReviewMessage(message, reviewNote))

  return (
    <NumberTuningSection
      id={getSettingsSectionId('bird-count')}
      icon={BirdIcon}
      title={t('Mức giảm tỷ lệ về tổ')}
      subtitle={t('Giảm quá mức này so với 7 ngày trước thì cảnh báo')}
      scopeLabel={t('Nhà')}
      footerNote={canEdit ? joinFooterNotes(t('Áp dụng cho cả nhà'), reviewNote) : undefined}
      keys={BIRD_COUNT_KEYS}
      rules={BIRD_COUNT_TUNING_RULES}
      values={house.bird_count_tuning}
      getLabel={getBirdCountTuningLabel}
      canEdit={canEdit}
      editor={editor}
      save={values => updateBirdCountTuning.mutateAsync({ houseId: house._id, tuning: values })}
      savedMessage={t('Đã lưu mức giảm tỷ lệ về tổ')}
      onSaved={showSaved}
    />
  )
}
