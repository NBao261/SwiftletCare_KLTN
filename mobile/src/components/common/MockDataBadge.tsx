import { StyleSheet, View } from 'react-native'
import { FlaskIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Nhãn "Dữ liệu mẫu" đặt trên mọi khối đang lấy dữ liệu từ services/mock (Report 3 có, backend chưa có route):
// không để dữ liệu mẫu trông như dữ liệu thật (mobile/CLAUDE.md)
export function MockDataBadge() {
  const palette = usePalette()

  return (
    <View
      style={[styles.badge, { backgroundColor: palette.surfaceStrong }]}
      accessible
      accessibilityLabel={t('Dữ liệu mẫu, backend chưa có')}
    >
      <FlaskIcon size={12} color={palette.textSecondary} />
      <Text variant="small" weight="semiBold" color={palette.textSecondary}>
        {t('Dữ liệu mẫu')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
})
