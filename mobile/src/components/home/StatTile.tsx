import { StyleSheet, View } from 'react-native'
import { DotsThreeVerticalIcon, type Icon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

// Cùng cỡ và bo góc với ô icon của thanh Tỷ lệ về tổ
const ICON_BOX_SIZE = 40
// Chiều cao ô khi có số: lề 12×2 + icon 40 + khoảng 8 + nhãn 16 + khoảng 4 + số 26
const STAT_TILE_HEIGHT = 118

// Màu icon theo tình trạng: neutral khi chưa có số, healthy khi ổn, problem khi có lỗi/cảnh báo
export type StatTone = 'neutral' | 'healthy' | 'problem'

interface StatTileProps {
  icon: Icon
  tone: StatTone
  label: string
  value: string
  // Chạm cả ô (kể cả dấu 3 chấm) đều mở bảng lựa chọn
  onPress: () => void
  // Đang tải số: hiện khung xương trắng đúng cỡ ô
  isLoading?: boolean
}

// Ô số liệu gọn của Trang chủ: icon trong ô xám bo góc + dấu 3 chấm, nhãn 1 dòng, số lớn
export function StatTile({ icon: IconComponent, tone, label, value, onPress, isLoading = false }: StatTileProps) {
  const palette = usePalette()
  if (isLoading) {
    return (
      <View style={styles.tileSlot}>
        <Skeleton width="100%" height={STAT_TILE_HEIGHT} delayMs={HOME_SKELETON_DELAY_MS.stats} />
      </View>
    )
  }
  const iconColor = { neutral: palette.text, healthy: palette.deviceOnline, problem: palette.alert }[tone]

  return (
    <Card style={styles.tile} onPress={onPress} accessibilityLabel={`${label}: ${value}`} accessibilityHint={t('Mở thêm lựa chọn')}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: palette.surfaceStrong }]}>
          <IconComponent size={20} color={iconColor} />
        </View>
        <DotsThreeVerticalIcon size={16} color={palette.textSecondary} weight="bold" />
      </View>
      <View style={styles.texts}>
        <Text variant="small" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="heading" weight="semiBold" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  // Ô gọn hơn card thường: lề và khoảng cách nhỏ hơn
  tile: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  tileSlot: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: Spacing.xs },
})
