import { StyleSheet, View } from 'react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Spacing } from '@/constants/theme'
import { t } from '@/utils/i18n.utils'

interface SettingsEditActionsProps {
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  // Chưa đổi gì hoặc còn ô lỗi thì khoá nút Lưu
  isSaveDisabled: boolean
  // Lỗi từ backend sau khi bấm Lưu
  error?: string | null
  // Chữ căn giữa thanh, mặc định "Cập nhật"
  label?: string
}

// Phần cuối của một mục đang sửa: câu lỗi, thanh đen là nút "Cập nhật" chữ căn giữa (chỉ gửi đúng mục này), nút chữ Huỷ bên dưới
export function SettingsEditActions({
  onSave,
  onCancel,
  isSaving,
  isSaveDisabled,
  error,
  label = t('Cập nhật'),
}: SettingsEditActionsProps) {
  return (
    <View style={styles.actions}>
      <FormMessage message={error} />
      <SettingsActionBar
        label={label}
        onPress={onSave}
        disabled={isSaveDisabled}
        loading={isSaving}
        accessibilityLabel={label}
      />
      <Button label={t('Huỷ')} variant="link" onPress={onCancel} disabled={isSaving} style={styles.cancel} />
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.sm },
  cancel: { alignSelf: 'center' },
})
