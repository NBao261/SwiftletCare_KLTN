import { SlidersHorizontalIcon } from 'phosphor-react-native'
import { NumberTuningSection } from '@/components/farm/settings/NumberTuningSection'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useUpdateFuzzyTuning } from '@/hooks/farm/useUpdateFuzzyTuning'
import { useAuthStore } from '@/stores/authStore'
import type { Zone } from '@/types'
import { getFuzzyTuningLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import { FUZZY_TUNING_RULES, type FuzzyNumberKey } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const FUZZY_KEYS = Object.keys(FUZZY_TUNING_RULES) as FuzzyNumberKey[]

interface FuzzyTuningSectionProps {
  zone: Zone
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Mục "Hệ số bộ điều khiển fuzzy" của một zone (ENV-FR-021, ENV-FR-022): chủ trại và chuyên gia sửa,
// backend gửi xuống controller của zone ngay, không cần nạp lại firmware
export function FuzzyTuningSection({ zone, editor, onSaved }: FuzzyTuningSectionProps) {
  const user = useAuthStore(state => state.user)
  const updateFuzzyTuning = useUpdateFuzzyTuning()

  return (
    <NumberTuningSection
      id={getSettingsSectionId('fuzzy', zone._id)}
      icon={SlidersHorizontalIcon}
      title={t('Tự điều khiển phun sương và quạt')}
      subtitle={t('Cách phun sương và quạt phản ứng quanh ngưỡng')}
      scopeLabel={zone.name}
      footerNote={t('Lưu xong áp dụng ngay cho khu vực')}
      keys={FUZZY_KEYS}
      rules={FUZZY_TUNING_RULES}
      values={zone.fuzzy_tuning}
      getLabel={getFuzzyTuningLabel}
      toggle={{ label: getFuzzyTuningLabel('fuzzy_input_filter').label, value: zone.fuzzy_tuning?.fuzzy_input_filter }}
      canEdit={canPerform(user, 'editFuzzyTuning')}
      editor={editor}
      save={(values, inputFilter) =>
        updateFuzzyTuning.mutateAsync({ zoneId: zone._id, tuning: { ...values, fuzzy_input_filter: inputFilter } })
      }
      savedMessage={t('Đã lưu cài đặt phun sương và quạt')}
      onSaved={onSaved}
    />
  )
}
