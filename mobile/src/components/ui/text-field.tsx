import { useState, type Ref } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { EyeIcon, EyeSlashIcon, type Icon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  // Tên ô cho trình đọc màn hình; cũng là chữ gợi ý khi không truyền placeholder
  label: string
  // Icon bên trái ô (Phosphor)
  icon?: Icon
  // Lỗi của riêng ô này, hiện dưới ô
  error?: string | null
  // Viền cam dù không có câu lỗi riêng (lỗi chung của form)
  hasError?: boolean
  // Gợi ý dưới ô khi không có lỗi, ví dụ luật độ dài mật khẩu
  helperText?: string
  // Ô mật khẩu: ẩn chữ, có nút mắt để hiện
  isPassword?: boolean
  // Tùy biến kiểu dáng khung ngoài
  style?: StyleProp<ViewStyle>
  ref?: Ref<TextInputInstance>
}

const MULTILINE_MAX_HEIGHT = 144

// Ô nhập nền xám bo tròn hết cỡ (hoặc Radius.lg khi multiline), icon bên trái; không viền, chỉ viền khi đang nhập hoặc lỗi
export function TextField({
  label,
  icon: LeadingIcon,
  error,
  hasError,
  helperText,
  isPassword = false,
  placeholder,
  style,
  ref,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const palette = usePalette()
  const [isFocused, setFocused] = useState(false)
  const [isPasswordVisible, setPasswordVisible] = useState(false)
  const isInvalid = Boolean(error) || Boolean(hasError)
  const borderColor = isInvalid ? palette.alert : isFocused ? palette.text : 'transparent'

  const isMultiline = Boolean(props.multiline)

  return (
    <View style={[styles.field, style]}>
      <View
        style={[
          styles.box,
          { backgroundColor: palette.surface, borderColor },
          isMultiline && styles.boxMultiline,
        ]}
      >
        {LeadingIcon && <LeadingIcon size={20} color={palette.textSecondary} />}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={palette.textSecondary}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: palette.text },
            isMultiline && styles.inputMultiline,
          ]}
          onFocus={event => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={event => {
            setFocused(false)
            onBlur?.(event)
          }}
          {...props}
        />
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
            hitSlop={Spacing.md}
            onPress={() => setPasswordVisible(isVisible => !isVisible)}
          >
            {isPasswordVisible ? (
              <EyeIcon size={20} color={palette.textSecondary} />
            ) : (
              <EyeSlashIcon size={20} color={palette.textSecondary} />
            )}
          </Pressable>
        )}
      </View>
      {error ? (
        <Text variant="small" color={palette.alert} style={styles.note} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="small" color={palette.textSecondary} style={styles.note}>
          {helperText}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.xs },
  // Cao tối thiểu 52 thay vì cố định: chữ dài xuống dòng thì ô cao theo, không tràn ra ngoài khung
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
  },
  boxMultiline: {
    minHeight: 88,
    borderRadius: Radius.lg,
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  input: { ...Typography.body, flex: 1, paddingVertical: Spacing.sm },
  // Ô nhiều dòng cao tối đa khoảng 6 dòng rồi cuộn trong ô, không đẩy form dài ra khi gõ ghi chú dài
  inputMultiline: {
    minHeight: 72,
    maxHeight: MULTILINE_MAX_HEIGHT,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  // Thụt vào thẳng mép chữ trong ô bo tròn
  note: { paddingHorizontal: Spacing.lg },
})
