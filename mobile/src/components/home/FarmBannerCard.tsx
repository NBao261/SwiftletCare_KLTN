import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowUpRightIcon } from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useActiveAlertCount } from '@/hooks/alert/useActiveAlertCount'
import { useHouses } from '@/hooks/farm/useHouses'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Farm } from '@/types'
import { t } from '@/utils/i18n.utils'

const CARD_HEIGHT = 168
const ARROW_BUTTON_SIZE = 48
const OUTER_RING_SIZE = 250
const INNER_RING_SIZE = 150
// Tâm 2 vòng trùng tâm nút mũi tên (cách mép phải và mép trên một khoảng bằng lề + nửa nút)
const RING_CENTER_OFFSET = Spacing.lg + ARROW_BUTTON_SIZE / 2

interface FarmBannerCardProps {
  farm: Farm
  width: number
}

// Câu tình trạng: số cảnh báo đang mở của cả Farm; chưa có số thì "_"
function getAlertText(activeAlertCount: number | undefined): string {
  if (activeAlertCount === undefined) return t('_ cảnh báo đang mở')
  if (activeAlertCount === 0) return t('Không có cảnh báo đang mở')
  return t('{count} cảnh báo đang mở', { count: activeAlertCount })
}

// Khung tổng quan của MỘT Farm: tên Farm, tổng số nhà yến, số cảnh báo đang mở của cả Farm
export function FarmBannerCard({ farm, width }: FarmBannerCardProps) {
  const palette = usePalette()
  const housesQuery = useHouses(farm._id)
  const alertCountQuery = useActiveAlertCount(farm._id)

  const houseCount = housesQuery.data?.data.length
  const activeAlertCount = alertCountQuery.data
  const houseText = houseCount === undefined ? t('_ nhà yến') : t('{count} nhà yến', { count: houseCount })
  const alertText = getAlertText(activeAlertCount)
  // Cam chỉ dùng khi có cảnh báo; không có thì chữ xám trên nền tối
  const alertColor = activeAlertCount ? palette.alert : palette.onInverseSecondary

  return (
    // Farm chưa có trường ảnh trong API — nền đen với 2 vòng olive quanh nút mũi tên
    <Card tone="inverse" style={[styles.card, { width }]}>
      {/* 2 vòng trang trí: vòng ngoài olive mờ, vòng trong olive đậm hơn */}
      <View
        style={[styles.ring, styles.outerRing, { backgroundColor: palette.farmRingOuter }]}
        importantForAccessibility="no"
      />
      <View
        style={[styles.ring, styles.innerRing, { backgroundColor: palette.farmRingInner }]}
        importantForAccessibility="no"
      />

      <View style={styles.topRow}>
        <Text variant="title" color={palette.primary} numberOfLines={1} style={styles.name}>
          {farm.name}
        </Text>
        <PressableScale
          style={[styles.arrowButton, { backgroundColor: palette.primary }]}
          onPress={() => router.navigate({ pathname: '/(tabs)/farms', params: { farmId: farm._id } })}
          accessibilityRole="button"
          accessibilityLabel={t('Xem chi tiết {name}', { name: farm.name })}
        >
          <ArrowUpRightIcon size={20} color={palette.onPrimary} weight="bold" />
        </PressableScale>
      </View>

      <View style={styles.summary} accessible accessibilityLabel={`${houseText}, ${alertText}`}>
        <Text variant="body" weight="semiBold" color={palette.onInverse}>
          {houseText}
        </Text>
        <Text variant="small" color={alertColor}>
          {alertText}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderRadius: Radius.full },
  outerRing: {
    width: OUTER_RING_SIZE,
    height: OUTER_RING_SIZE,
    top: RING_CENTER_OFFSET - OUTER_RING_SIZE / 2 - 10,
    right: RING_CENTER_OFFSET - OUTER_RING_SIZE / 2,
  },
  innerRing: {
    width: INNER_RING_SIZE,
    height: INNER_RING_SIZE,
    top: RING_CENTER_OFFSET - INNER_RING_SIZE / 2 - 10,
    right: RING_CENTER_OFFSET - INNER_RING_SIZE / 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  name: { flex: 1 },
  arrowButton: {
    width: ARROW_BUTTON_SIZE,
    height: ARROW_BUTTON_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { gap: Spacing.xs },
})
