import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { FLOOR_RULE, parseNumberInput, validateNumber } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface CreateItemSheetProps {
  visible: boolean
  title: string
  // Nhãn nhỏ góc phải: nơi tạo mới ("Nhà A", "Farm Phú Yên")
  scopeLabel: string
  nameLabel: string
  // Ô số đi kèm tên: số tầng của nhà, tầng số của zone (số nguyên từ 1)
  numberLabel: string
  // Gửi lên backend; lỗi thì ném ra để sheet hiện câu báo
  submit: (name: string, value: number) => Promise<unknown>
  onCreated: () => void
  onClose: () => void
}

// Sheet tạo nhanh một nhà yến hoặc một tầng (FARM-FR-002): tên và một ô số, cùng khung lưới thông tin và thanh đen
export function CreateItemSheet({
  visible,
  title,
  scopeLabel,
  nameLabel,
  numberLabel,
  submit,
  onCreated,
  onClose,
}: CreateItemSheetProps) {
  const palette = usePalette()
  const [name, setName] = useState('')
  const [numberText, setNumberText] = useState('1')
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const numberError = validateNumber(numberText, FLOOR_RULE)
  const isValid = name.trim() !== '' && numberError === null

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
            },
            isFullWidth: true,
          },
          {
            label: numberLabel,
            input: { value: numberText, onChangeText: setNumberText, label: numberLabel, keyboardType: 'number-pad' },
            error: numberText === '' ? null : numberError,
          },
        ]}
      />
      <FormMessage message={error} />
      <SettingsActionBar
        label={title}
        value={t('TẠO')}
        onPress={handleSubmit}
        disabled={!isValid}
        loading={isSaving}
        accessibilityLabel={title}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1, maxWidth: '45%' },
})
