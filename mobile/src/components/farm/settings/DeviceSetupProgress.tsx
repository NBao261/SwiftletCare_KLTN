import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { CheckIcon } from 'phosphor-react-native'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { type SetupDeviceKind, useSetupDeviceStatus } from '@/hooks/device/useSetupDeviceStatus'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const STEP_ICON_SIZE = 24

type StepState = 'done' | 'waiting' | 'coming-soon'

interface DeviceSetupProgressProps {
  kind: SetupDeviceKind
  // _id của bản ghi thiết bị vừa đăng ký (API trả về khi đăng ký)
  deviceRecordId: string
}

// Tiến trình setup thiết bị (FARM-FR-012): đã đăng ký (PENDING) → đã kết nối (heartbeat đầu tiên) → đã áp cấu hình khu vực.
// Bước cuối cần phiên bản cấu hình thiết bị báo lên (ENV-FR-027) mà backend chưa có (G-08) nên ghi "Sắp có", không đoán.
// Quá 15 phút chưa kết nối thì nhắc kiểm tra bước cài Wi-Fi (BR-27)
export function DeviceSetupProgress({ kind, deviceRecordId }: DeviceSetupProgressProps) {
  const palette = usePalette()
  const setup = useSetupDeviceStatus(kind, deviceRecordId)
  const isOnline = setup.status === 'ONLINE' || setup.status === 'OFFLINE'
  const steps: { key: string; label: string; state: StepState; caption?: string }[] = [
    { key: 'registered', label: t('Đã đăng ký'), state: 'done' },
    {
      key: 'online',
      label: t('Đã kết nối'),
      state: isOnline ? 'done' : 'waiting',
      caption: isOnline ? undefined : t('Đang chờ thiết bị gửi tín hiệu đầu tiên'),
    },
    ...(kind === 'controller'
      ? [{ key: 'applied', label: t('Đã áp cấu hình khu vực'), state: 'coming-soon' as const, caption: t('Sắp có') }]
      : []),
  ]

  return (
    <View style={styles.progress}>
      <Text variant="body" weight="semiBold">
        {t('Tiến trình')}
      </Text>
      {steps.map(step => (
        <View key={step.key} style={styles.step}>
          <View
            style={[
              styles.icon,
              { backgroundColor: step.state === 'done' ? palette.primary : palette.surfaceStrong },
            ]}
          >
            {step.state === 'done' && <CheckIcon size={14} color={palette.onPrimary} weight="bold" />}
            {step.state === 'waiting' && <ActivityIndicator size="small" color={palette.textSecondary} />}
          </View>
          <View style={styles.texts}>
            <Text
              variant="body"
              weight={step.state === 'done' ? 'semiBold' : undefined}
              color={step.state === 'coming-soon' ? palette.textSecondary : palette.text}
            >
              {step.label}
            </Text>
            {step.caption && (
              <Text variant="small" color={palette.textSecondary}>
                {step.caption}
              </Text>
            )}
          </View>
        </View>
      ))}
      {setup.isOverdue && (
        <FormMessage
          message={
            kind === 'controller'
              ? t('Quá 15 phút thiết bị chưa kết nối. Kiểm tra lại bước cài Wi-Fi ở trên.')
              : t('Quá 15 phút camera chưa kết nối. Kiểm tra máy đếm chim đã bật và có mạng.')
          }
        />
      )}
      {setup.isError && <FormMessage message={t('Không tải được trạng thái thiết bị, đang thử lại')} />}
    </View>
  )
}

const styles = StyleSheet.create({
  progress: { gap: Spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: {
    width: STEP_ICON_SIZE,
    height: STEP_ICON_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0 },
})
