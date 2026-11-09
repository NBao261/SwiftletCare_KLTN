import { StyleSheet, View } from 'react-native'
import type { Icon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const CARD_WIDTH = 132
const ICON_BOX_SIZE = 40

interface ProfileShortcutCardProps {
  icon: Icon
  title: string
  // Dòng phụ: số chưa đọc, số ngày chờ…; chưa tải xong thì truyền "_"
  caption: string
  onPress?: () => void
  // Chưa có API: thẻ khoá, ghi "Sắp có"
  isComingSoon?: boolean
}

// Thẻ vuông trong hàng lối tắt kéo ngang của trang Tài khoản (theo ảnh mẫu)
export function ProfileShortcutCard({ icon: CardIcon, title, caption, onPress, isComingSoon = false }: ProfileShortcutCardProps) {
  const palette = usePalette()
  const isDisabled = isComingSoon || !onPress

  return (
    <PressableScale
      style={[styles.card, { backgroundColor: palette.surface }]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={`${title}, ${isComingSoon ? t('Sắp có') : caption}`}
    >
      <View style={[styles.iconBox, { backgroundColor: palette.surfaceStrong }]}>
        <CardIcon size={20} color={isComingSoon ? palette.textSecondary : palette.text} />
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="medium" numberOfLines={2} color={isComingSoon ? palette.textSecondary : palette.text}>
          {title}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
          {isComingSoon ? t('Sắp có') : caption}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_WIDTH,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: 2 },
})
