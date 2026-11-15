import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { CheckIcon, WarningIcon } from 'phosphor-react-native'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { type SetupDeviceKind, useSetupDeviceStatus } from '@/hooks/device/useSetupDeviceStatus'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ConfigApplyStep } from '@/utils/device.utils'
import { t } from '@/utils/i18n.utils'

const STEP_ICON_SIZE = 24

// done: xong · waiting: đang chờ (vòng quay) · upcoming: chưa tới hoặc không xác nhận được · problem: lỗi cần chú ý
type StepState = 'done' | 'waiting' | 'upcoming' | 'problem'

interface ProgressStep {
  key: string
  label: string
  state: StepState
  caption?: string
}

// Bước "Đã áp cấu hình khu vực" theo config_sync của controller (ENV-FR-027)
function buildConfigStep(configStep: ConfigApplyStep): ProgressStep {
  const label = t('Đã áp cấu hình khu vực')
  switch (configStep) {
    case 'applied':
      return { key: 'applied', label, state: 'done' }
    case 'waiting-connection':
      return { key: 'applied', label, state: 'upcoming', caption: t('Sau khi thiết bị kết nối') }
    case 'waiting-config':
      return { key: 'applied', label, state: 'waiting', caption: t('Đang chờ thiết bị nhận cấu hình của khu vực') }
    case 'mismatch':
      return {
        key: 'applied',
        label,
        state: 'problem',
        caption: t('Thiết bị chưa áp cấu hình mới nhất, hệ thống đang gửi lại'),
      }
    case 'unknown':
      return {
        key: 'applied',
        label,
        state: 'upcoming',
        caption: t('Firmware của thiết bị không báo phiên bản cấu hình nên chưa xác nhận được bước này'),
      }
  }
}

interface DeviceSetupProgressProps {
  kind: SetupDeviceKind
  // _id của bản ghi thiết bị vừa đăng ký (API trả về khi đăng ký)
  deviceRecordId: string
}

// Tiến trình setup thiết bị (FARM-FR-012): đã đăng ký (PENDING) → đã kết nối (heartbeat đầu tiên) → đã áp cấu hình khu vực
// (controller: heartbeat báo đúng phiên bản cấu hình của Zone, config_sync = APPLIED — ENV-FR-027).
// Quá 15 phút chưa kết nối thì nhắc kiểm tra bước cài Wi-Fi (BR-27)
export function DeviceSetupProgress({ kind, deviceRecordId }: DeviceSetupProgressProps) {
  const palette = usePalette()
  const setup = useSetupDeviceStatus(kind, deviceRecordId)
  const isOnline = setup.status === 'ONLINE'
  // Đã từng kết nối rồi mất (OFFLINE): chờ kết nối lại, khác với thiết bị mới chưa gửi tín hiệu nào (PENDING)
  const connectionCaption =
    setup.status === 'OFFLINE' ? t('Thiết bị đang mất kết nối, chờ kết nối lại') : t('Đang chờ thiết bị gửi tín hiệu đầu tiên')
  const steps: ProgressStep[] = [
    { key: 'registered', label: t('Đã đăng ký'), state: 'done' },
    {
      key: 'online',
      label: t('Đã kết nối'),
      state: isOnline ? 'done' : 'waiting',
      caption: isOnline ? undefined : connectionCaption,
    },
    ...(setup.configStep ? [buildConfigStep(setup.configStep)] : []),
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
            {step.state === 'problem' && <WarningIcon size={14} color={palette.alert} weight="bold" />}
          </View>
          <View style={styles.texts}>
            <Text
              variant="body"
              weight={step.state === 'done' ? 'semiBold' : undefined}
              color={step.state === 'upcoming' ? palette.textSecondary : palette.text}
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
