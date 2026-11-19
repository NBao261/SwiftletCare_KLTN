import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { PlantIcon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useSetHouseStage } from '@/hooks/farm/useSetHouseStage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { House, HouseStage } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { getHouseStageLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId } from '@/utils/settingsSection.utils'
import { t } from '@/utils/i18n.utils'

const HOUSE_STAGES: readonly HouseStage[] = ['ATTRACTING', 'OCCUPIED']
// Nhà tạo trước FARM-FR-014 chưa có giai đoạn: backend mặc định OCCUPIED
const DEFAULT_STAGE: HouseStage = 'OCCUPIED'

interface HouseStageSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Câu giải thích ảnh hưởng của từng giai đoạn tới đánh giá ngày (BR-46)
function getStageNote(stage: HouseStage): string {
  return stage === 'ATTRACTING'
    ? t('Chim chưa về ở: đánh giá ngày không xét chỉ số đàn và không cảnh báo tỷ lệ về tổ thấp.')
    : t('Chim đã về ở: đánh giá ngày xét đủ chỉ số đàn, so với các ngày trước từ ngày đổi.')
}

// Phần đang sửa: chọn một trong hai giai đoạn rồi lưu
function HouseStageEditor({ house, editor, onSaved }: HouseStageSectionProps) {
  const palette = usePalette()
  const original = house.stage ?? DEFAULT_STAGE
  const [stage, setStage] = useState<HouseStage>(original)
  const [error, setError] = useState<string | null>(null)
  const setHouseStage = useSetHouseStage()

  const choose = (next: HouseStage) => {
    setStage(next)
    editor.setDirty(next !== original)
  }

  const submit = () => {
    setError(null)
    setHouseStage.mutate(
      { houseId: house._id, stage },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã đổi giai đoạn nhà'))
        },
        onError: saveError => setError(getSettingsErrorMessage(saveError)),
      },
    )
  }

  return (
    <>
      <View style={styles.chips}>
        {HOUSE_STAGES.map(item => (
          <ChoiceChip
            key={item}
            label={getHouseStageLabel(item)}
            isSelected={stage === item}
            onPress={() => choose(item)}
            placement="card"
          />
        ))}
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {getStageNote(stage)}
      </Text>
      <SettingsEditActions
        onSave={submit}
        onCancel={editor.cancelEditing}
        isSaving={setHouseStage.isPending}
        isSaveDisabled={stage === original}
        error={error}
      />
    </>
  )
}

// Mục "Giai đoạn nhà" (FARM-FR-014): Đang dẫn dụ hoặc Đã có chim ở. Chủ trại và chuyên gia đổi; kỹ thuật viên chỉ xem
export function HouseStageSection({ house, editor, onSaved }: HouseStageSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const id = getSettingsSectionId('stage')
  const isEditing = editor.isEditing(id)
  const stage = house.stage ?? DEFAULT_STAGE

  return (
    <SettingsSection
      icon={PlantIcon}
      title={t('Giai đoạn nhà')}
      subtitle={getHouseStageLabel(stage)}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canPerform(user, 'setHouseStage') ? () => editor.startEditing(id) : undefined}
      isEditing={isEditing}
    >
      {isEditing ? (
        <HouseStageEditor house={house} editor={editor} onSaved={onSaved} />
      ) : (
        <>
          <Text variant="small" color={palette.textSecondary}>
            {getStageNote(stage)}
          </Text>
        </>
      )}
    </SettingsSection>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
})
