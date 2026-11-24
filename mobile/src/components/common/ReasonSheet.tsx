import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const NOTE_INPUT_HEIGHT = 96
// Ghi chú mở lại, lý do huỷ, lý do từ chối tối đa 1000 ký tự (Report 3 §4.5)
const NOTE_MAX_LENGTH = 1000

interface ReasonSheetProps {
  visible: boolean
  title: string
  description: string
  placeholder: string
  submitLabel: string
  isSubmitting: boolean
  // Lỗi từ backend sau khi gửi
  error?: string | null
  onSubmit: (reason: string) => void
  onClose: () => void
}

// Sheet nhập lý do bắt buộc trước một thao tác (mở lại, huỷ phiếu công việc, từ chối khuyến nghị); chưa có chữ thì khoá nút gửi.
// Màn mở sheet bằng key mới mỗi lần để ô nhập bắt đầu trống
export function ReasonSheet({
  visible,
  title,
  description,
  placeholder,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: ReasonSheetProps) {
  const palette = usePalette()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  // Đang gửi thì không cho đóng, để không mất kết quả
  const closeUnlessBusy = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={closeUnlessBusy}>
      <Text variant="heading">{title}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {description}
      </Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        editable={!isSubmitting}
        placeholder={placeholder}
        placeholderTextColor={palette.textSecondary}
        accessibilityLabel={placeholder}
        textAlignVertical="top"
        style={[styles.input, { backgroundColor: palette.surfaceStrong, borderColor: palette.border, color: palette.text }]}
      />
      <FormMessage message={error} />
      <Button label={submitLabel} onPress={() => onSubmit(trimmed)} disabled={trimmed === ''} loading={isSubmitting} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  input: {
    ...Typography.body,
    height: NOTE_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
