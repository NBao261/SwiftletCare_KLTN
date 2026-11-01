import { Alert as NativeAlert, Pressable, StyleSheet, View } from 'react-native'
import { CollapsibleSection } from '@/components/farm/CollapsibleSection'
import { RelayIcon } from '@/components/common/RelayIcon'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useClearRelayOverride } from '@/hooks/device/useClearRelayOverride'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Alert, RelayName, SensorNode, TelemetryRecord } from '@/types'
import { getControlModeLabel, getRelayLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { countManualControllers, formatClockTime, formatSpeakerWindows } from '@/utils/relay.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const RELAYS: RelayName[] = ['misting', 'ventilation', 'speaker']
const ICON_CIRCLE_SIZE = 36

interface ActuatorSectionProps {
  // Controller của zone đang chọn
  controllers: SensorNode[]
  // Bản ghi mới nhất của zone: % phun sương / % quạt do bộ điều khiển mờ tính
  telemetry: TelemetryRecord | null
  zoneAlerts: Alert[]
  onSelectRelay: (controller: SensorNode, relay: RelayName) => void
}

// Phần % công suất của relay, chỉ phun sương và quạt có; chưa có số thì null
function getPowerText(relay: RelayName, telemetry: TelemetryRecord | null): string | null {
  const value = relay === 'misting' ? telemetry?.misting_pct : relay === 'ventilation' ? telemetry?.ventilation_pct : undefined
  return value === undefined || value === null ? null : `${formatDecimal(value)}%`
}

// Khối "Thiết bị chấp hành" (thu gọn mặc định): trạng thái từng relay, chế độ AUTO/tay; Farm Owner chạm relay để điều khiển tay
export function ActuatorSection({ controllers, telemetry, zoneAlerts, onSelectRelay }: ActuatorSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const canControl = canPerform(user, 'controlRelay')
  const canClear = canPerform(user, 'clearRelayOverride')
  const clearOverride = useClearRelayOverride()
  const manualCount = countManualControllers(controllers)
  // Bơm chạy mà độ ẩm không tăng (THREAT-FR-011): backend báo bằng cảnh báo, không có cờ trên controller
  const isMistingIneffective = zoneAlerts.some(alert => alert.type === 'MISTING_INEFFECTIVE')

  // Không có relay (zone chưa có controller) thì ẩn khối
  if (controllers.length === 0) return null

  // Trả mọi relay của controller về AUTO — backend chỉ có một hạn chung cho cả controller (ENV-FR-018)
  const confirmClear = (controller: SensorNode) =>
    NativeAlert.alert(t('Trả về AUTO'), t('Mọi relay của bộ điều khiển {device} sẽ về tự động.', { device: controller.device_id }), [
      { text: t('Huỷ'), style: 'cancel' },
      { text: t('Trả về AUTO'), onPress: () => clearOverride.mutate(controller._id) },
    ])

  return (
    <CollapsibleSection
      title={t('Thiết bị chấp hành ({count})', { count: controllers.length * RELAYS.length })}
      caption={manualCount > 0 ? t('{count} đang điều khiển tay', { count: manualCount }) : t('AUTO')}
      captionColor={manualCount > 0 ? palette.alert : undefined}
    >
      {clearOverride.isError && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Không gửi được lệnh, thử lại')}
        </Text>
      )}
      {controllers.map(controller => {
        const isManual = controller.control_mode === 'MANUAL'
        const isOnline = controller.status === 'ONLINE'
        const expiryText =
          isManual && controller.override_expiry
            ? t('tự về AUTO lúc {time}', { time: formatClockTime(controller.override_expiry) })
            : null
        return (
          <View key={controller._id} style={styles.controller}>
            <View style={styles.controllerHeader}>
              <View style={styles.flex}>
                <Text variant="small" weight="semiBold" numberOfLines={1}>
                  {controller.device_id}
                </Text>
                <Text variant="small" color={isManual ? palette.alert : palette.textSecondary}>
                  {[getControlModeLabel(controller.control_mode), expiryText].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {isManual && canClear && (
                <Button
                  label={t('Trả về AUTO')}
                  size="sm"
                  variant="secondary"
                  onPress={() => confirmClear(controller)}
                  disabled={!isOnline || clearOverride.isPending}
                />
              )}
            </View>
            {RELAYS.map(relay => {
              const isOn = controller.relay_states[relay]
              const powerText = getPowerText(relay, telemetry)
              const extraText =
                relay === 'speaker'
                  ? formatSpeakerWindows(controller.speaker_schedule)
                  : relay === 'misting' && isMistingIneffective
                    ? t('Phun sương không hiệu quả')
                    : null
              const stateText = [isOn ? t('BẬT') : t('TẮT'), powerText].filter(Boolean).join(' · ')
              const isPressable = canControl && isOnline
              return (
                <Pressable
                  key={relay}
                  style={[styles.relayRow, { borderTopColor: palette.divider }]}
                  onPress={isPressable ? () => onSelectRelay(controller, relay) : undefined}
                  disabled={!isPressable}
                  accessibilityRole={isPressable ? 'button' : undefined}
                  accessibilityLabel={[getRelayLabel(relay), stateText, extraText].filter(Boolean).join(', ')}
                  accessibilityHint={isPressable ? t('Mở điều khiển tay') : undefined}
                >
                  <View style={[styles.iconCircle, { backgroundColor: isOn ? palette.primary : palette.surfaceStrong }]}>
                    <RelayIcon relay={relay} color={isOn ? palette.onPrimary : palette.textSecondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="body" weight="semiBold">
                      {getRelayLabel(relay)}
                    </Text>
                    {extraText && (
                      <Text
                        variant="small"
                        color={relay === 'misting' ? palette.alert : palette.textSecondary}
                        numberOfLines={1}
                      >
                        {extraText}
                      </Text>
                    )}
                  </View>
                  <Text variant="body" weight="semiBold">
                    {stateText}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )
      })}
    </CollapsibleSection>
  )
}

const styles = StyleSheet.create({
  controller: { gap: Spacing.sm },
  controllerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0, gap: Spacing.xs },
  relayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: BorderWidth.hairline,
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
