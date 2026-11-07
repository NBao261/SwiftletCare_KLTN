import { useState } from 'react'
import { StyleSheet, TextInput, type KeyboardTypeOptions } from 'react-native'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Cao đủ chạm (44) mà vẫn gọn trong một dòng bảng
const INPUT_HEIGHT = 44

export interface SettingsInputProps {
  value: string
  onChangeText: (text: string) => void
  // Tên ô cho trình đọc màn hình
  label: string
  placeholder?: string
  hasError?: boolean
  // Ô số căn phải như cột số của bảng; ô chữ căn trái
  align?: 'left' | 'right'
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'characters' | 'words'
  editable?: boolean
}

// Ô nhập gọn trong bảng và lưới thông tin của trang cài đặt: nền Paper bo nhỏ, viền Ink khi đang nhập, viền cam khi lỗi
export function SettingsInput({
  value,
  onChangeText,
  label,
  placeholder,
  hasError = false,
  align = 'right',
  keyboardType = 'decimal-pad',
  autoCapitalize = 'none',
  editable = true,
}: SettingsInputProps) {
  const palette = usePalette()
  const [isFocused, setFocused] = useState(false)
  const borderColor = hasError ? palette.alert : isFocused ? palette.text : 'transparent'

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={palette.textSecondary}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      editable={editable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        { backgroundColor: palette.surfaceStrong, borderColor, color: palette.text, textAlign: align },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    ...Typography.body,
    height: INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
})
