import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useDecommissionDevice } from '@/hooks/device/useDecommissionDevice'
import { useRestoreDevice } from '@/hooks/device/useRestoreDevice'
import { usePalette } from '@/hooks/theme/usePalette'
import type { DeviceKind } from '@/services/api/device.api'
import type { DeviceStatus } from '@/types'
import { getDeviceRemoveErrorMessage, getDeviceRestoreErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

// Thiết bị cần gỡ hoặc khôi phục; status chỉ cần khi gỡ (thiết bị đang trực tuyến phải gửi force)
export interface RemoveDeviceTarget {
  mode: 'remove' | 'restore'
  kind: DeviceKind
  recordId: string
  deviceId: string
  status?: DeviceStatus
}

// Thiết bị vừa gỡ, để màn hiện nút khôi phục trong 24 giờ
export interface RemovedDevice {
  kind: DeviceKind
  recordId: string
  deviceId: string
  decommissionedAt: string
}

interface RemoveDeviceSheetProps {
  // null: sheet đóng. Mỗi lần mở, màn truyền key mới để ô lý do bắt đầu trống
  target: RemoveDeviceTarget | null
  onClose: () => void
  // removed: có khi vừa gỡ xong, null khi vừa khôi phục
  onDone: (message: string, removed: RemovedDevice | null) => void
}

// Gỡ thiết bị giữ lịch sử dữ liệu, hoặc khôi phục thiết bị vừa gỡ trong 24 giờ (FARM-FR-008). Lý do bắt buộc (backend ghi audit).
// Gỡ luôn hỏi lại; thiết bị đang trực tuyến thì nói rõ khu vực sẽ mất giám sát và gửi force
export function RemoveDeviceSheet({ target, onClose, onDone }: RemoveDeviceSheetProps) {
  const palette = usePalette()
  const decommission = useDecommissionDevice()
  const restore = useRestoreDevice()
  const [reason, setReason] = useState('')
  const isRestore = target?.mode === 'restore'
  const isOnline = target?.status === 'ONLINE'
  const mutation = isRestore ? restore : decommission
  const errorMessage = mutation.error
    ? isRestore
      ? getDeviceRestoreErrorMessage(mutation.error)
      : getDeviceRemoveErrorMessage(mutation.error)
    : null

  const sendRemove = (device: RemoveDeviceTarget) =>
    decommission.mutate(
      { kind: device.kind, deviceRecordId: device.recordId, reason: reason.trim(), ...(isOnline ? { force: true } : {}) },
      {
        onSuccess: removedNode =>
          onDone(t('Đã gỡ {device}', { device: device.deviceId }), {
            kind: device.kind,
            recordId: device.recordId,
            deviceId: device.deviceId,
            decommissionedAt: removedNode.decommissioned_at ?? new Date().toISOString(),
          }),
      },
    )

  const submit = () => {
    if (!target) return
    if (isRestore) {
      restore.mutate(
        { kind: target.kind, deviceRecordId: target.recordId, reason: reason.trim() },
        { onSuccess: () => onDone(t('Đã khôi phục {device}', { device: target.deviceId }), null) },
      )
      return
    }
    NativeAlert.alert(
      t('Gỡ {device}?', { device: target.deviceId }),
      isOnline
        ? t('Thiết bị đang trực tuyến: gỡ thì khu vực này mất giám sát và điều khiển tự động. Lịch sử dữ liệu vẫn được giữ.')
        : t('Thiết bị sẽ ẩn khỏi danh sách, lịch sử dữ liệu vẫn được giữ. Khôi phục được trong 24 giờ.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Gỡ'), style: 'destructive', onPress: () => sendRemove(target) },
      ],
    )
  }

  return (
    <BottomSheet visible={target !== null} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {isRestore ? t('Khôi phục thiết bị') : t('Gỡ thiết bị')}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline} numberOfLines={1}>
          {target?.deviceId ?? ''}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="small" color={palette.textSecondary}>
          {isRestore
            ? t('Thiết bị hiện lại trong danh sách và chờ kết nối lại. Cảnh báo đã đóng lúc gỡ không mở lại.')
            : t('Thiết bị ẩn khỏi danh sách, dữ liệu cũ vẫn tra cứu được. Sau khi gỡ, nhãn cũ đăng ký lại được.')}
        </Text>
        {!isRestore && isOnline && <FormMessage message={t('Thiết bị đang trực tuyến')} />}
        <SettingsMetaGrid
          items={[
            {
              label: t('Lý do'),
              input: { value: reason, onChangeText: setReason, label: t('Lý do'), autoCapitalize: 'sentences' },
              isFullWidth: true,
            },
          ]}
        />
        <FormMessage message={errorMessage} />
        <SettingsActionBar
          label={isRestore ? t('Khôi phục thiết bị') : t('Gỡ thiết bị')}
          value={t('GỬI')}
          onPress={submit}
          disabled={reason.trim() === ''}
          loading={mutation.isPending}
          accessibilityLabel={isRestore ? t('Khôi phục thiết bị') : t('Gỡ thiết bị')}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1, maxWidth: '45%' },
  body: { gap: Spacing.md },
})
