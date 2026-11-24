import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { SimulatedBadge } from '@/components/common/SimulatedBadge'
import type { SelectedDevice } from '@/components/farm/DeviceSection'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { useRestartController } from '@/hooks/device/useRestartController'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getDeviceRestartErrorMessage } from '@/utils/apiError.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { formatFreeHeap, formatUptime, getConfigApplyStep } from '@/utils/device.utils'
import { getConfigApplyLabel, getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'
import { canPerform } from '@/utils/permission.utils'

interface DeviceDetailSheetProps {
  selected: SelectedDevice | null
  onClose: () => void
}

interface DetailRow {
  label: string
  value: string
  // Cam khi controller chưa áp cấu hình mới (CONFIG_MISMATCH, BR-24)
  isWarning?: boolean
}

// Các dòng chẩn đoán của thiết bị (FARM-FR-006) và bước áp cấu hình của controller (ENV-FR-027); thiếu số thì "_"
function getDetailRows(selected: SelectedDevice): DetailRow[] {
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
  const configStep = getConfigApplyStep(controller.status, controller.config_sync)
  return [
    { label: t('Trạng thái'), value: getDeviceStatusLabel(controller.status) },
    { label: t('Cấu hình khu vực'), value: getConfigApplyLabel(configStep), isWarning: configStep === 'mismatch' },
    {
      label: t('Phiên bản cấu hình đang chạy'),
      value: controller.applied_config_version == null ? '_' : String(controller.applied_config_version),
    },
    { label: t('Phiên bản firmware'), value: controller.firmware_version || '_' },
    { label: t('Thời gian chạy'), value: formatUptime(controller.booted_at) },
    { label: t('Wi-Fi RSSI'), value: controller.rssi === undefined ? '_' : `${controller.rssi} dBm` },
    { label: t('Bộ nhớ trống'), value: formatFreeHeap(controller.free_heap) },
    { label: t('Lý do khởi động gần nhất'), value: controller.reset_reason ?? '_' },
    { label: t('Địa chỉ IP'), value: controller.ip ?? '_' },
    { label: t('Heartbeat gần nhất'), value: heartbeat },
  ]
}

// Chi tiết một thiết bị: chẩn đoán chỉ xem; controller trực tuyến có nút khởi động lại từ xa (FARM-FR-013). Thiết lập, chuyển,
// thay thiết bị làm ở luồng cài đặt thiết bị (SF-01)
export function DeviceDetailSheet({ selected, onClose }: DeviceDetailSheetProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const restartController = useRestartController()
  const [result, setResult] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
  if (!selected) return null

  const controller = selected.kind === 'controller' ? selected.device : null
  const canRestart = controller !== null && canPerform(user, 'restartController')

  // Khởi động lại controller
  const handleRestart = () => {
    if (!controller) return
    NativeAlert.alert(
      t('Khởi động lại {device}?', { device: controller.device_id }),
      t('Bộ điều khiển sẽ mất kết nối trong lúc khởi động rồi tự kết nối lại.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Khởi động lại'),
          onPress: () => {
            setResult(null)
            restartController.mutate(controller._id, {
              onSuccess: () => setResult({ tone: 'success', message: t('Đã gửi lệnh khởi động lại') }),
              onError: error => setResult({ tone: 'error', message: getDeviceRestartErrorMessage(error) }),
            })
          },
        },
      ],
    )
  }

  // Đóng sheet thì bỏ kết quả của lần khởi động trước
  const handleClose = () => {
    setResult(null)
    onClose()
  }

  return (
    <BottomSheet visible onClose={handleClose}>
      <Text variant="heading" numberOfLines={1}>
        {selected.device.device_id}
      </Text>
      <Text variant="small" color={palette.textSecondary}>
        {selected.kind === 'controller' ? t('Controller') : t('Camera AI')}
      </Text>
      <SimulatedBadge simulated={selected.device.simulated} />
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
            <Text variant="body" weight="semiBold" numberOfLines={1} color={row.isWarning ? palette.alert : undefined}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      {canRestart && controller && (
        <View style={styles.actions}>
          <Button
            label={t('Khởi động lại')}
            variant="outline"
            size="md"
            onPress={handleRestart}
            loading={restartController.isPending}
            disabled={controller.status !== 'ONLINE'}
          />
          {controller.status !== 'ONLINE' && (
            <Text variant="small" color={palette.textSecondary}>
              {t('Chỉ khởi động lại được khi thiết bị đang trực tuyến')}
            </Text>
          )}
          <FormMessage message={result?.message} tone={result?.tone} />
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  label: { flex: 1 },
  actions: { gap: Spacing.sm },
})
