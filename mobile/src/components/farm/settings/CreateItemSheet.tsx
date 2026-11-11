import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  NAME_MAX_LENGTH,
  parseNumberInput,
  validateName,
  validateNumber,
  type NumberRule,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface CreateItemSheetProps {
  visible: boolean
  title: string
  // Nhãn nhỏ góc phải: nơi tạo mới ("Nhà A", "Farm Phú Yên")
  scopeLabel: string
  nameLabel: string
  // Ô số đi kèm tên: số tầng của nhà (HOUSE_FLOOR_RULE), tầng số của zone (getZoneFloorRule theo số tầng nhà)
  numberLabel: string
  numberRule: NumberRule
  // Tên đang có cùng cấp (nhà trong farm, khu vực trong nhà): trùng thì báo duplicateMessage và khoá nút tạo
  existingNames: readonly string[]
  duplicateMessage: string
  // Gửi lên backend; lỗi thì ném ra để sheet hiện câu báo
  submit: (name: string, value: number) => Promise<unknown>
  onCreated: () => void
  onClose: () => void
}

// Sheet tạo nhanh một nhà yến hoặc một tầng (FARM-FR-002): tên và một ô số, cùng khung lưới thông tin; nút "Tạo mới" + Huỷ
// cùng khung với nút "Cập nhật" của các mục cài đặt (SettingsEditActions)
export function CreateItemSheet({
  visible,
  title,
  scopeLabel,
  nameLabel,
  numberLabel,
  numberRule,
  existingNames,
  duplicateMessage,
  submit,
  onCreated,
  onClose,
}: CreateItemSheetProps) {
  const palette = usePalette()
  const [name, setName] = useState('')
  const [numberText, setNumberText] = useState('1')
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameError = validateName(name, existingNames, duplicateMessage)
  const numberError = validateNumber(numberText, numberRule)
  const isValid = nameError === null && numberError === null

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      await submit(name.trim(), parseNumberInput(numberText) as number)
      onCreated()
    } catch (submitError) {
      setError(getSettingsErrorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {title}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline} numberOfLines={1}>
          {scopeLabel}
        </Text>
      </View>
      <SettingsMetaGrid
        items={[
          {
            label: nameLabel,
            input: {
              value: name,
              onChangeText: setName,
              label: nameLabel,
              keyboardType: 'default',
              autoCapitalize: 'sentences',
              maxLength: NAME_MAX_LENGTH,
            },
            // Ô còn trống thì chưa báo lỗi, chỉ khoá nút Tạo mới
            error: name === '' ? null : nameError,
            isFullWidth: true,
          },
          {
            label: numberLabel,
            input: { value: numberText, onChangeText: setNumberText, label: numberLabel, keyboardType: 'number-pad' },
            error: numberText === '' ? null : numberError,
          },
        ]}
      />
      <SettingsEditActions
        label={t('Tạo mới')}
        onSave={handleSubmit}
        onCancel={onClose}
        isSaving={isSaving}
        isSaveDisabled={!isValid}
        error={error}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1, maxWidth: '45%' },
})
