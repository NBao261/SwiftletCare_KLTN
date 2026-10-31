import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRightIcon, ThermometerIcon, WarningIcon, WifiSlashIcon } from 'phosphor-react-native'
import { LATEST_ALERT_PARAMS } from '@/components/home/AlertStatTile'
import { Button } from '@/components/ui/button'
import { SplitBadge } from '@/components/ui/split-badge'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useActiveAlertSummary } from '@/hooks/alert/useActiveAlertSummary'
import { useAlerts } from '@/hooks/alert/useAlerts'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, AlertType, House, Zone } from '@/types'
import { getAlertHeadline, pickMostUrgentAlert } from '@/utils/alert.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { truncateText } from '@/utils/name.utils'
import { getSeverityLevel, getSeverityLevelColors, getSeverityLevelLabel } from '@/utils/severity.utils'
import { t } from '@/utils/i18n.utils'

const ICON_CIRCLE_SIZE = 48
// Ô mức độ rộng cố định, vừa chữ dài nhất "KHẨN CẤP", để 3 cấp cùng một cỡ
const SEVERITY_PILL_WIDTH = 84
// Tên nhà trong nhãn tối đa 10 ký tự, dài hơn thì cắt và thêm "…"
const HOUSE_NAME_MAX_LENGTH = 10
// Loang chéo từ góc trên trái xuống góc dưới phải
const GRADIENT_START = { x: 0, y: 0 }
const GRADIENT_END = { x: 1, y: 1 }

// Icon theo loại cảnh báo: ngưỡng môi trường → nhiệt kế, mất kết nối → wifi gạch, còn lại → tam giác
function AlertTypeIcon({ type, color }: { type: AlertType; color: string }) {
  if (type === 'THRESHOLD_BREACH' || type === 'FORECAST_BREACH') return <ThermometerIcon size={24} color={color} />
  if (type === 'NODE_OFFLINE' || type === 'EDGE_AI_DEGRADED') return <WifiSlashIcon size={24} color={color} />
  return <WarningIcon size={24} color={color} />
}

// Nơi xảy ra: tầng (nếu cảnh báo gắn tầng) và nhà chứa nó; cảnh báo của cả nhà thì chỉ có nhà
function getAlertLocation(alert: Alert, zones: Zone[], houses: House[]): { zone?: Zone; house?: House } {
  const zone = alert.zone_id ? zones.find(item => item._id === alert.zone_id) : undefined
  const houseId = zone?.house_id ?? alert.house_id
  return { zone, house: houses.find(item => item._id === houseId) }
}

// Khối 4 Trang chủ: cảnh báo đang mở khẩn nhất của mọi Farm; không có cảnh báo thì ẩn hẳn
export function UrgentAlertBanner() {
  const palette = usePalette()
  const { data: alertSummary } = useActiveAlertSummary()
  const latestAlertsQuery = useAlerts(LATEST_ALERT_PARAMS)
  const housesQuery = useAllHouses()
  const zonesQuery = useZonesOfHouses(housesQuery.houses.map(house => house._id))

  const alert = pickMostUrgentAlert(latestAlertsQuery.data?.data ?? [])
  if (!alert) return null
  const pendingCount = alertSummary?.total

  const { zone, house } = getAlertLocation(alert, zonesQuery.zones, housesQuery.houses)
  // Nhãn 2 ngăn: cấp mức độ như web | tên nhà; tên tầng nằm trong câu chính nên không lặp lại
  const severityLevel = getSeverityLevel(alert.severity)
  const severityText = getSeverityLevelLabel(severityLevel).toUpperCase()
  // Màu ô mức độ theo cấu hình severityP1..P3 (P1 Khẩn cấp: nền cam, chữ trắng)
  const severityColors = getSeverityLevelColors(severityLevel, palette)
  const pendingText =
    pendingCount === undefined ? t('_ chưa xử lý') : t('{count} chưa xử lý', { count: String(pendingCount).padStart(2, '0') })
  const headline = getAlertHeadline(alert, zone?.name)
  // Nền loang cam #FF7426 → đỏ cảnh báo #D53F35, đều là token cảnh báo/lỗi có sẵn
  const backgroundColors = [palette.alert, palette.deviceError] as const

  return (
    <LinearGradient colors={backgroundColors} start={GRADIENT_START} end={GRADIENT_END} style={styles.card}>
      {/* Hàng đầu: icon và nhãn mức độ căn giữa theo chiều dọc */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: palette.onAlertTint }]}>
          <AlertTypeIcon type={alert.type} color={palette.onInverse} />
        </View>
        {/* Viên ngoài trắng 55% chữ mực; ô mức độ theo màu cấu hình mức độ */}
        <SplitBadge
          left={severityText}
          leftWidth={SEVERITY_PILL_WIDTH}
          right={house ? truncateText(house.name, HOUSE_NAME_MAX_LENGTH) : undefined}
          color={palette.onInverseSecondary}
          textColor={palette.text}
          innerColor={severityColors.background}
          innerTextColor={severityColors.text}
        />
      </View>

      {/* Câu chính xuống hàng riêng, thẳng mép trái với icon */}
      <Text variant="body" weight="bold" color={palette.text} numberOfLines={3}>
        {headline}
      </Text>

      <View style={styles.bottomRow}>
        {/* Số cảnh báo chưa xử lý nằm trên dòng thời gian */}
        <View style={styles.meta}>
          <Text variant="small" weight="semiBold" color={palette.text} numberOfLines={1}>
            {pendingText}
          </Text>
          <Text variant="small" color={palette.text} numberOfLines={1}>
            {formatTimeAgo(alert.created_at)}
          </Text>
        </View>
        <Button
          label={t('Xử lý ngay')}
          variant="inverse"
          size="md"
          trailingIcon={ArrowRightIcon}
          onPress={() => router.push({ pathname: '/alert/[alertId]', params: { alertId: alert._id } })}
          accessibilityLabel={t('Xử lý ngay: {headline}', { headline })}
        />
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.lg },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meta: { flex: 1, gap: Spacing.xs },
})
