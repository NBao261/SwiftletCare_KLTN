import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Language } from '@/stores/languageStore'

const FLAG_SIZE = 20

// Mã ngôn ngữ 3 chữ và cờ của từng ngôn ngữ — giữ nguyên, không dịch. Cờ là ảnh phẳng hình vuông, tâm cờ ở giữa ảnh
// (assets/images/flags), không dùng emoji vì emoji cờ của iOS có nếp gợn và lệch dòng; màu cờ nằm trong ảnh, không vào palette
const LANGUAGE_DISPLAY: Record<Language, { code: string; flag: number; name: string }> = {
  vi: { code: 'VIE', flag: require('@/assets/images/flags/flag-vn.png'), name: 'Tiếng Việt' },
  en: { code: 'ENG', flag: require('@/assets/images/flags/flag-gb.png'), name: 'English' },
}

interface LanguageFlagProps {
  language: Language
}

// Phần bên phải hàng "Ngôn ngữ" ở tab Tài khoản: mã ngôn ngữ + lá cờ tròn
export function LanguageFlag({ language }: LanguageFlagProps) {
  const palette = usePalette()
  const display = LANGUAGE_DISPLAY[language]

  return (
    <View style={styles.wrapper} accessible accessibilityLabel={display.name}>
      <Text variant="label" weight="semiBold">
        {display.code}
      </Text>
      <Image source={display.flag} style={[styles.flag, { borderColor: palette.divider }]} accessible={false} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flag: {
    width: FLAG_SIZE,
    height: FLAG_SIZE,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.hairline,
  },
})
