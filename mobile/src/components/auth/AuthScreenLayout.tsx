import type { ReactNode } from 'react'
import { Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { CollapsesWithKeyboard } from '@/components/auth/CollapsesWithKeyboard'
import { AppHeader } from '@/components/layout/AppHeader'
import { TextLogo } from '@/components/layout/TextLogo'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface AuthScreenLayoutProps {
  title: string
  description?: ReactNode
  // Chỉ màn đăng nhập hiện logo chữ
  showsLogo?: boolean
  // Không truyền thì không có nút quay lại
  onBack?: () => void
  children: ReactNode
  footer?: ReactNode
}

// Khung chung của các màn xác thực, không cuộn. Form căn giữa phần màn hình phía trên bàn phím nên chỉ nhích lên
// vừa đủ; logo, mô tả, chân trang thu lại cùng nhịp bàn phím (CollapsesWithKeyboard)
export function AuthScreenLayout({ title, description, showsLogo = false, onBack, children, footer }: AuthScreenLayoutProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  // 0 → 1 theo bàn phím mở, chạy trên UI thread ở cả Android và iOS
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      {/* Có nút quay lại thì dùng header chung; màn đăng nhập chỉ chừa vùng an toàn trên cùng */}
      {onBack ? <AppHeader onBack={onBack} /> : <View style={{ height: insets.top }} />}

      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        {/* Chạm ra ngoài ô nhập thì đóng bàn phím */}
        <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.body}>
            {showsLogo && (
              <CollapsesWithKeyboard keyboardProgress={keyboardProgress} style={styles.logo}>
                <TextLogo />
              </CollapsesWithKeyboard>
            )}

            <View style={styles.heading}>
              <Text variant="title" weight="semiBold" center>
                {title}
              </Text>
              {description && (
                <CollapsesWithKeyboard keyboardProgress={keyboardProgress}>
                  <Text variant="body" color={palette.textSecondary} center>
                    {description}
                  </Text>
                </CollapsesWithKeyboard>
              )}
            </View>

            <View style={styles.form}>{children}</View>
          </View>

          {footer && (
            <CollapsesWithKeyboard keyboardProgress={keyboardProgress}>
              <View style={styles.footer}>{footer}</View>
            </CollapsesWithKeyboard>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  body: { flex: 1, justifyContent: 'center', gap: Spacing.xl },
  logo: { alignSelf: 'center' },
  heading: { gap: Spacing.sm, alignItems: 'center' },
  form: { gap: Spacing.md },
  footer: { alignItems: 'center', paddingTop: Spacing.lg },
})
