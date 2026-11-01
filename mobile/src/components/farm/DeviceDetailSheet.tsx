import { StyleSheet, View } from 'react-native'
import type { SelectedDevice } from '@/components/farm/DeviceSection'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatTimeAgo } from '@/utils/date.utils'
import { formatFreeHeap, formatUptime } from '@/utils/device.utils'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

interface DeviceDetailSheetProps {
  selected: SelectedDevice | null
  onClose: () => void
}

// Các dòng chẩn đoán của thiết bị (FARM-FR-006); thiếu số thì "_"
function getDetailRows(selected: SelectedDevice): { label: string; value: string }[] {
  const { device } = selected
  const heartbeat = device.last_heartbeat ? formatTimeAgo(device.last_heartbeat) : '_'
  if (selected.kind === 'camera') {
    return [
      { label: t('Trạng thái'), value: getDeviceStatusLabel(device.status) },
      { label: t('Phiên bản mô hình'), value: selected.device.model_version ?? '_' },
      { label: t('Heartbeat gần nhất'), value: heartbeat },
    ]
  }
  const controller = selected.device
  return [
    { label: t('Trạng thái'), value: getDeviceStatusLabel(controller.status) },
    { label: t('Phiên bản firmware'), value: controller.firmware_version || '_' },
    { label: t('Thời gian chạy'), value: formatUptime(controller.booted_at) },
    { label: t('Wi-Fi RSSI'), value: controller.rssi === undefined ? '_' : `${controller.rssi} dBm` },
    { label: t('Bộ nhớ trống'), value: formatFreeHeap(controller.free_heap) },
    { label: t('Lý do khởi động gần nhất'), value: controller.reset_reason ?? '_' },
    { label: t('Địa chỉ IP'), value: controller.ip ?? '_' },
    { label: t('Heartbeat gần nhất'), value: heartbeat },
  ]
}

// Chi tiết một thiết bị, chỉ xem — thiết lập, chuyển, thay thiết bị làm ở luồng cài đặt thiết bị (MF-10)
export function DeviceDetailSheet({ selected, onClose }: DeviceDetailSheetProps) {
  const palette = usePalette()
  if (!selected) return null

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading" numberOfLines={1}>
        {selected.device.device_id}
      </Text>
      <Text variant="small" color={palette.textSecondary}>
        {selected.kind === 'controller' ? t('Controller') : t('Camera AI')}
      </Text>
      <View>
        {getDetailRows(selected).map((row, index) => (
          <View
            key={row.label}
            style={[styles.row, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
            accessible
            accessibilityLabel={`${row.label}: ${row.value}`}
          >
            <Text variant="body" color={palette.textSecondary} style={styles.label}>
              {row.label}
            </Text>
            <Text variant="body" weight="semiBold" numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  label: { flex: 1 },
})
