import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import {
  CaretRightIcon,
  CircleIcon,
  DropIcon,
  PlusCircleIcon,
  ThermometerIcon,
  ToggleRightIcon,
  WarningIcon,
  WifiSlashIcon,
} from 'phosphor-react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import type { AppColors } from '@/constants/theme'
import { Radius, Spacing } from '@/constants/theme'
import type { HouseCardData } from '@/hooks/farm/useHouseStatuses'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HouseStatus } from '@/utils/houseStatus.utils'
import { t } from '@/utils/i18n.utils'

export const HOUSE_CARD_HEIGHT = 176
const ICON_CIRCLE_SIZE = 40
const OUTER_RING_SIZE = 150
const INNER_RING_SIZE = 96

// Mỗi trạng thái một hình riêng để người mù màu vẫn phân biệt được; màu theo token trạng thái có sẵn
function HouseStatusIcon({ status, palette }: { status: HouseStatus; palette: AppColors['light'] }) {
  switch (status.kind) {
    case 'offline':
      return <WifiSlashIcon size={20} color={palette.deviceOffline} weight="bold" />
    case 'critical':
      return <WarningIcon size={20} color={palette.alert} weight="bold" />
    case 'threshold':
      return status.metric === 'humidity' ? (
        <DropIcon size={20} color={palette.alert} weight="bold" />
      ) : (
        <ThermometerIcon size={20} color={palette.alert} weight="bold" />
      )
    case 'attention':
      return <CircleIcon size={14} color={palette.statusResolved} weight="fill" />
    case 'setup':
      return <PlusCircleIcon size={20} color={palette.devicePending} weight="bold" />
    case 'manual':
      return <ToggleRightIcon size={20} color={palette.text} weight="bold" />
    case 'ok':
      return <CircleIcon size={14} color={palette.houseHealthy} weight="fill" />
  }
}

// Mở màn theo trạng thái; màn nào chưa có thì tạm mở trang Farm chứa nhà hoặc tab gần nhất
function openStatusTarget({ house, status }: HouseCardData) {
  const target = status.target
  if (target.screen === 'alert') {
    router.push({ pathname: '/alert/[alertId]', params: { alertId: target.alertId } })
    return
  }
  if (target.screen === 'zone') {
    router.push({ pathname: '/zone/[zoneId]', params: { zoneId: target.zoneId } })
    return
  }
  // shortcut: chưa có danh sách cảnh báo lọc theo nhà — tạm mở tab Cảnh báo
  if (target.screen === 'house-alerts') {
    router.navigate('/(tabs)/alerts')
    return
  }
  // shortcut: chưa có màn quét QR thêm thiết bị (MF-10) — tạm mở tab Trang trại
  if (target.screen === 'add-device') {
    router.navigate('/(tabs)/farms')
    return
  }
  // shortcut: chưa có màn chi tiết nhà và trang thiết bị của nhà — tạm mở Farm chứa nhà
  router.push({ pathname: '/farm/[farmId]', params: { farmId: house.farm_id } })
}

interface HouseStatusCardProps {
  data: HouseCardData
  width: number
}

// Thẻ một nhà yến: nền lime, 2 vòng mực trang trí ở góc dưới trái, trạng thái nặng nhất ở dòng cuối
export function HouseStatusCard({ data, width }: HouseStatusCardProps) {
  const palette = usePalette()
  const { house, farmName, status, activeAlertCount } = data
  const alertText = t('{count} cảnh báo', { count: activeAlertCount })
  const accessibilityLabel = [house.name, farmName, activeAlertCount > 0 ? alertText : null, status.message]
    .filter(Boolean)
    .join(', ')

  return (
    <PressableScale
      style={[styles.card, { width, backgroundColor: palette.primary }]}
      onPress={() => openStatusTarget(data)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* 2 vòng mực chồng nhau: vòng dưới nhạt, vòng trên đậm hơn */}
      <View style={[styles.ring, styles.outerRing, { backgroundColor: palette.inverse }]} />
      <View style={[styles.ring, styles.innerRing, { backgroundColor: palette.inverse }]} />

      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: palette.surface }]}>
          <HouseStatusIcon status={status} palette={palette} />
        </View>
        <View style={styles.names}>
          <Text variant="heading" weight="semiBold" color={palette.onPrimary} numberOfLines={1}>
            {house.name}
          </Text>
          <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
            {farmName}
          </Text>
        </View>
        {activeAlertCount > 0 && (
          <View style={[styles.badge, { backgroundColor: palette.inverse }]}>
            <Text variant="label" weight="bold" color={palette.onInverse}>
              {alertText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomRow}>
        <Text variant="body" weight="semiBold" color={palette.onPrimary} numberOfLines={2} style={styles.message}>
          {status.message}
        </Text>
        <CaretRightIcon size={16} color={palette.onPrimary} weight="bold" />
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    height: HOUSE_CARD_HEIGHT,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  ring: { position: 'absolute', borderRadius: Radius.full },
  outerRing: {
    width: OUTER_RING_SIZE,
    height: OUTER_RING_SIZE,
    left: -OUTER_RING_SIZE / 3,
    bottom: -OUTER_RING_SIZE / 2,
    opacity: 0.08,
  },
  innerRing: {
    width: INNER_RING_SIZE,
    height: INNER_RING_SIZE,
    left: -INNER_RING_SIZE / 4,
    bottom: -INNER_RING_SIZE / 2,
    opacity: 0.16,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flex: 1, minWidth: 0 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  message: { flex: 1 },
})
