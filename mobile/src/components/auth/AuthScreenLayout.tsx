import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { AppHeader } from '@/components/layout/AppHeader'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// Logo chữ 1492 × 342 px — giữ đúng tỉ lệ khi thu về 160 px
const LOGO_TEXT_WIDTH = 160
const LOGO_TEXT_HEIGHT = Math.round((LOGO_TEXT_WIDTH * 342) / 1492)

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

// Khung chung của các màn xác thực: không cuộn; khi bàn phím mở thì ẩn logo, mô tả và chân trang để form vừa màn hình
export function AuthScreenLayout({ title, description, showsLogo = false, onBack, children, footer }: AuthScreenLayoutProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [isKeyboardVisible, setKeyboardVisible] = useState(false)

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [])

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      {/* Có nút quay lại thì dùng header chung; màn đăng nhập chỉ chừa vùng an toàn trên cùng */}
      {onBack ? <AppHeader onBack={onBack} /> : <View style={{ height: insets.top }} />}
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.body}>
            {showsLogo && !isKeyboardVisible && (
              <Image
                source={require('@/assets/images/mobile-scare-text.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="SwiftletCare"
              />
            )}
            <View style={styles.heading}>
              <Text variant={isKeyboardVisible ? 'heading' : 'title'} weight="semiBold" center>
                {title}
              </Text>
              {description && !isKeyboardVisible && (
                <Text variant="body" color={palette.textSecondary} center>
                  {description}
                </Text>
              )}
            </View>
            <View style={styles.form}>{children}</View>
          </View>

          {footer && !isKeyboardVisible && <View style={styles.footer}>{footer}</View>}
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  body: { flex: 1, justifyContent: 'center', gap: Spacing.xl },
  logo: { width: LOGO_TEXT_WIDTH, height: LOGO_TEXT_HEIGHT, alignSelf: 'center' },
  heading: { gap: Spacing.sm, alignItems: 'center' },
  form: { gap: Spacing.md },
  footer: { alignItems: 'center', paddingTop: Spacing.lg },
})
