import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { CollapsibleSection } from '@/components/farm/CollapsibleSection'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CameraNode, DeviceStatus, SensorNode } from '@/types'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const DOT_SIZE = 8

export type SelectedDevice = { kind: 'controller'; device: SensorNode } | { kind: 'camera'; device: CameraNode }

interface DeviceSectionProps {
  controllers: SensorNode[]
  cameras: CameraNode[]
  onSelect: (selected: SelectedDevice) => void
}

// Khối "Thiết bị" (thu gọn mặc định): controller của zone và camera của nhà; chạm để xem chi tiết, chỉ xem
export function DeviceSection({ controllers, cameras, onSelect }: DeviceSectionProps) {
  const palette = usePalette()
  const statusDotColor: Record<DeviceStatus, string> = {
    ONLINE: palette.deviceOnline,
    OFFLINE: palette.deviceOffline,
    PENDING: palette.devicePending,
  }
  const devices: SelectedDevice[] = [
    ...controllers.map(device => ({ kind: 'controller' as const, device })),
    ...cameras.map(device => ({ kind: 'camera' as const, device })),
  ]
  const offlineCount = devices.filter(({ device }) => device.status === 'OFFLINE').length
  const caption = t('{controllers} controller · {cameras} camera · {offline} offline', {
    controllers: controllers.length,
    cameras: cameras.length,
    offline: offlineCount,
  })

  return (
    <CollapsibleSection
      title={t('Thiết bị')}
      caption={caption}
      captionColor={offlineCount > 0 ? palette.alert : undefined}
    >
      {devices.length === 0 && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Chưa có thiết bị')}
        </Text>
      )}
      {devices.map((selected, index) => {
        const typeLabel = selected.kind === 'controller' ? t('Controller') : t('Camera AI')
        const statusLabel = getDeviceStatusLabel(selected.device.status)
        return (
          <Pressable
            key={selected.device._id}
            style={[styles.row, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
            onPress={() => onSelect(selected)}
            accessibilityRole="button"
            accessibilityLabel={`${selected.device.device_id}, ${typeLabel}, ${statusLabel}`}
            accessibilityHint={t('Xem chi tiết thiết bị')}
          >
            <View style={styles.texts}>
              <Text variant="body" weight="semiBold" numberOfLines={1}>
                {selected.device.device_id}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {typeLabel}
              </Text>
            </View>
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: statusDotColor[selected.device.status] }]} />
              <Text variant="small">{statusLabel}</Text>
            </View>
            <CaretRightIcon size={16} color={palette.textSecondary} />
          </Pressable>
        )
      })}
    </CollapsibleSection>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
