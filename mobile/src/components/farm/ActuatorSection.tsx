import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { CollapsibleSection } from '@/components/farm/CollapsibleSection'
import { RelayRow } from '@/components/farm/RelayRow'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useClearRelayOverride } from '@/hooks/device/useClearRelayOverride'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Alert, RelayName, SensorNode, TelemetryRecord } from '@/types'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { countManualRelays, formatSpeakerWindows, getManualRelays } from '@/utils/relay.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const RELAYS: readonly RelayName[] = ['misting', 'ventilation', 'speaker']

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

// Khối "Thiết bị chấp hành" (thu gọn mặc định): mỗi relay một dòng có nút gạt BẬT/TẮT cho Farm Owner, chế độ và hạn riêng
// của từng relay (BR-20); controller có từ 2 relay điều khiển tay thì thêm nút trả tất cả về AUTO
export function ActuatorSection({ controllers, telemetry, zoneAlerts, onSelectRelay }: ActuatorSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const canControl = canPerform(user, 'controlRelay')
  const canClear = canPerform(user, 'clearRelayOverride')
  const clearAll = useClearRelayOverride()
  const manualCount = countManualRelays(controllers, RELAYS)
  // Bơm chạy mà độ ẩm không tăng (THREAT-FR-011): backend báo bằng cảnh báo, không có cờ trên controller
  const isMistingIneffective = zoneAlerts.some(alert => alert.type === 'MISTING_INEFFECTIVE')

  // Không có relay (zone chưa có controller) thì ẩn khối
  if (controllers.length === 0) return null

  // Trả mọi relay của controller về AUTO (DELETE …/relay-override không kèm relayName)
  const confirmClearAll = (controller: SensorNode) =>
    NativeAlert.alert(t('Trả về AUTO tất cả'), t('Mọi relay của bộ điều khiển {device} sẽ về tự động.', { device: controller.device_id }), [
      { text: t('Huỷ'), style: 'cancel' },
      { text: t('Trả về AUTO'), onPress: () => clearAll.mutate({ sensorNodeId: controller._id }) },
    ])

  return (
    <CollapsibleSection
      title={t('Thiết bị chấp hành ({count})', { count: controllers.length * RELAYS.length })}
      caption={manualCount > 0 ? t('{count} relay đang điều khiển tay', { count: manualCount }) : t('AUTO')}
      captionColor={manualCount > 0 ? palette.alert : undefined}
    >
      {clearAll.isError && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Không gửi được lệnh, thử lại')}
        </Text>
      )}
      {controllers.map(controller => {
        const isOnline = controller.status === 'ONLINE'
        const manualRelays = getManualRelays(controller, RELAYS)
        const controllerCaption = !isOnline
          ? t('{status} — chưa điều khiển được', { status: getDeviceStatusLabel(controller.status) })
          : manualRelays.length > 0
            ? t('{count} relay đang điều khiển tay', { count: manualRelays.length })
            : t('AUTO')
        return (
          <View key={controller._id} style={styles.controller}>
            <View style={styles.controllerHeader}>
              <View style={styles.flex}>
                <Text variant="small" weight="semiBold" numberOfLines={1}>
                  {controller.device_id}
                </Text>
                <Text variant="small" color={manualRelays.length > 0 || !isOnline ? palette.alert : palette.textSecondary}>
                  {controllerCaption}
                </Text>
              </View>
              {manualRelays.length >= 2 && canClear && (
                <Button
                  label={t('Về AUTO tất cả')}
                  size="sm"
                  variant="secondary"
                  onPress={() => confirmClearAll(controller)}
                  disabled={!isOnline || clearAll.isPending}
                />
              )}
            </View>
            {RELAYS.map(relay => (
              <RelayRow
                key={relay}
                controller={controller}
                relay={relay}
                powerText={getPowerText(relay, telemetry)}
                extraText={
                  relay === 'speaker'
                    ? formatSpeakerWindows(controller.speaker_schedule)
                    : relay === 'misting' && isMistingIneffective
                      ? t('Phun sương không hiệu quả')
                      : null
                }
                isExtraAlert={relay === 'misting' && isMistingIneffective}
                canControl={canControl}
                canClear={canClear}
                onOpenSheet={() => onSelectRelay(controller, relay)}
              />
            ))}
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
})
