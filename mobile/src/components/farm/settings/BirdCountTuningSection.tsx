import { BirdIcon } from 'phosphor-react-native'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useUpdateBirdCountTuning } from '@/hooks/farm/useUpdateBirdCountTuning'
import { useAuthStore } from '@/stores/authStore'
import type { BirdCountTuning, House } from '@/types'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import { BIRD_COUNT_TUNING_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const BIRD_COUNT_KEYS = Object.keys(BIRD_COUNT_TUNING_RULES) as (keyof BirdCountTuning)[]

interface BirdCountTuningSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Tên và đơn vị của tham số đếm chim (schema BirdCountTuning trong api-spec)
function getBirdCountTuningLabel(): { label: string; unit: string } {
  return { label: t('Tỷ lệ về tổ giảm'), unit: '%' }
}

// Mục "Mức giảm tỷ lệ về tổ" của cả nhà (EXPERT-FR-008): giảm quá mức này so với kỳ trước thì báo LOW_RETURN_RATE.
// Chuyên gia sửa; farm chưa có chuyên gia thì chủ trại sửa thay (BR-22), còn lại chủ trại chỉ xem
export function BirdCountTuningSection({ house, editor, onSaved }: BirdCountTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(house.farm_id)
  const canEdit = canPerform(user, 'editBirdCountTuning', { farmHasExpert: hasExpert })
  const updateBirdCountTuning = useUpdateBirdCountTuning()

  return (
    <NumberTuningSection
      id={getSettingsSectionId('bird-count')}
      icon={BirdIcon}
      title={t('Mức giảm tỷ lệ về tổ')}
      subtitle={t('Giảm quá mức này so với kỳ trước thì cảnh báo')}
      scopeLabel={t('Nhà')}
      footerNote={
        canEdit
          ? hasExpert === false
            ? t('Farm chưa có chuyên gia nên bạn chỉnh thay. Áp dụng cho cả nhà')
            : t('Chỉ chuyên gia sửa được. Áp dụng cho cả nhà')
          : t('Do chuyên gia chỉnh')
      }
      keys={BIRD_COUNT_KEYS}
      rules={BIRD_COUNT_TUNING_RULES}
      values={house.bird_count_tuning}
      getLabel={getBirdCountTuningLabel}
      canEdit={canEdit}
      editor={editor}
      save={values => updateBirdCountTuning.mutateAsync({ houseId: house._id, tuning: values })}
      savedMessage={t('Đã lưu mức giảm tỷ lệ về tổ')}
      onSaved={onSaved}
      // Lịch đếm chim theo mùa (VISION-FR-019) backend chưa có API
      extra={<ComingSoonAction label={t('Lịch đếm chim')} />}
    />
  )
}
