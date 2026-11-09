import { useEffect, useState } from 'react'
import { Alert as NativeAlert, Pressable, StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { CONFIRMATION_REQUIRED_CODE, OVERRIDE_DEFAULT_MS, OVERRIDE_DURATION_OPTIONS_MS } from '@/constants/relayOverride'
import { Radius, Spacing } from '@/constants/theme'
import { usePumpBlockingAlerts } from '@/hooks/alert/usePumpBlockingAlerts'
import { useControlRelay } from '@/hooks/device/useControlRelay'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, RelayName, SensorNode } from '@/types'
import { parseConfirmationAlerts, type PumpBlockingAlert } from '@/utils/alert.utils'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { getAlertStatusLabel, getAlertTypeLabel, getRelayLabel } from '@/utils/label.utils'
import { buildPumpConfirmMessage, clampOverrideDuration, formatDuration, getOverrideDurationLimits } from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

// Thời gian chờ controller báo đã chuyển trạng thái = độ tươi của lệnh (BR-35, Report 3 §4.5: 60 s). Quá mốc này controller
// không còn áp dụng lệnh nên báo "chưa phản hồi" và cho gửi lại mà không sợ thành hai lệnh
const RELAY_ACK_TIMEOUT_MS = 60 * 1000

interface RelayControlSheetProps {
  // Controller mới nhất trong cache (tải lại sau RELAY_UPDATE) để biết lệnh đã áp dụng chưa
  controller: SensorNode | null
  relay: RelayName | null
  onClose: () => void
}

interface ChoiceChipProps {
  label: string
  isSelected: boolean
  onPress: () => void
}

// Ô chọn BẬT/TẮT hoặc thời lượng; đang chọn thì nền Ink chữ trắng
function ChoiceChip({ label, isSelected, onPress }: ChoiceChipProps) {
  const palette = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: isSelected ? palette.inverse : palette.surfaceStrong }]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
    >
      <Text variant="body" weight="semiBold" color={isSelected ? palette.onInverse : palette.text}>
        {label}
      </Text>
    </Pressable>
  )
}

// Sheet điều khiển tay một relay (ENV-FR-016): BẬT/TẮT, thời lượng theo BR-08, hết giờ tự về AUTO.
// Bật bơm khi khu vực đang có cảnh báo cảm biến hỏng / phun sương không hiệu quả (mới hoặc đã xác nhận) thì phải xác nhận;
// sheet tự tải mới các cảnh báo đó mỗi lần mở, chưa tải xong thì chưa cho gửi
export function RelayControlSheet({ controller, relay, onClose }: RelayControlSheetProps) {
  const palette = usePalette()
  const controlRelay = useControlRelay()
  const currentState = controller && relay ? controller.relay_states[relay] : false
  const [targetState, setTargetState] = useState(!currentState)
  const [durationMs, setDurationMs] = useState(OVERRIDE_DEFAULT_MS)
  // Đã gửi lệnh, chờ controller báo đúng trạng thái
  const [isWaiting, setWaiting] = useState(false)
  // Đã có lệnh tới broker trong lần mở sheet này: relay chuyển MANUAL đúng trạng thái lúc nào thì đóng sheet lúc đó, kể cả sau
  // khi đã hết thời gian chờ
  const [hasSent, setHasSent] = useState(false)
  // Lệnh không tới được controller: backend chưa nối broker, hoặc controller không báo lại trong thời gian chờ
  const [deliveryProblem, setDeliveryProblem] = useState<'not-delivered' | 'timed-out' | null>(null)

  const limits = relay ? getOverrideDurationLimits(relay, targetState) : null
  const options = limits ? OVERRIDE_DURATION_OPTIONS_MS.filter(option => option >= limits.minMs && option <= limits.maxMs) : []
  const effectiveDuration = limits ? clampOverrideDuration(durationMs, limits) : durationMs
  const isPumpOn = relay === 'misting' && targetState
  const blockingQuery = usePumpBlockingAlerts(controller?.zone_id ?? '', isPumpOn)
  const blockingAlerts: Alert[] = isPumpOn ? (blockingQuery.data ?? []) : []
  // Bật bơm mà chưa biết khu vực có cảnh báo chặn hay không thì chưa cho gửi
  const isCheckingAlerts = isPumpOn && (blockingQuery.isLoading || blockingQuery.isError)
  const isApplied = Boolean(
    controller && relay && controller.control_mode === 'MANUAL' && controller.relay_states[relay] === targetState,
  )

  // Controller đã chuyển MANUAL đúng trạng thái thì đóng sheet
  useEffect(() => {
    if (hasSent && isApplied) onClose()
  }, [hasSent, isApplied, onClose])

  // Không chờ mãi: quá thời gian mà controller chưa báo thì mở lại nút để thử lại
  useEffect(() => {
    if (!isWaiting || isApplied) return
    const timer = setTimeout(() => {
      setWaiting(false)
      setDeliveryProblem('timed-out')
    }, RELAY_ACK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isWaiting, isApplied])

  if (!controller || !relay) return null
  const relayLabel = getRelayLabel(relay)

  // Hỏi lại trước khi bật bơm, liệt kê từng cảnh báo đang mở; đồng ý thì gửi kèm xác nhận
  const confirmPumpOn = (alerts: PumpBlockingAlert[]) =>
    NativeAlert.alert(t('Vẫn bật bơm?'), buildPumpConfirmMessage(alerts, effectiveDuration), [
      { text: t('Huỷ'), style: 'cancel' },
      { text: t('Vẫn bật bơm'), style: 'destructive', onPress: () => send(true) },
    ])

  const send = (isAlertConfirmed: boolean) => {
    setDeliveryProblem(null)
    controlRelay.mutate(
      { sensorNodeId: controller._id, relay, state: targetState, durationMs: effectiveDuration, isAlertConfirmed },
      {
        onSuccess: ({ isCommandDelivered }) => {
          setDeliveryProblem(isCommandDelivered ? null : 'not-delivered')
          setWaiting(isCommandDelivered)
          if (isCommandDelivered) setHasSent(true)
        },
        onError: error => {
          // 409 CONFIRMATION_REQUIRED: lúc gửi khu vực đã có cảnh báo chặn mà app chưa kịp thấy — backend gửi kèm danh sách
          // trong error.details; hỏi lại bằng danh sách đó, đồng ý thì gửi lại kèm confirmed
          const errorInfo = readApiError(error)
          if (!isPumpOn || errorInfo.status !== 409 || errorInfo.code !== CONFIRMATION_REQUIRED_CODE) return
          const alerts = parseConfirmationAlerts(errorInfo.details)
          if (alerts.length > 0) confirmPumpOn(alerts)
          void blockingQuery.refetch()
        },
      },
    )
  }

  // TẮT và bật bơm khi có cảnh báo chặn đều hỏi lại trước khi gửi
  const handleSubmit = () => {
    if (isCheckingAlerts) return
    if (blockingAlerts.length > 0) {
      confirmPumpOn(blockingAlerts)
      return
    }
    if (!targetState) {
      NativeAlert.alert(t('Tắt {relay}?', { relay: relayLabel }), t('{relay} sẽ tắt trong {duration} rồi tự về AUTO.', {
        relay: relayLabel,
        duration: formatDuration(effectiveDuration),
      }), [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Tắt'), onPress: () => send(false) },
      ])
      return
    }
    send(false)
  }

  // Câu lỗi theo mã của backend thay cho một câu chung
  const errorMessage = controlRelay.isError
    ? getSettingsErrorMessage(controlRelay.error, {
        422: t('Thời lượng không hợp lệ: bật bơm tối đa 30 phút, còn lại tối đa 24 giờ'),
        409: t('Khu vực vừa có cảnh báo chặn bật bơm, vui lòng xem lại'),
      })
    : null

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{t('Điều khiển tay: {relay}', { relay: relayLabel })}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Hết thời lượng thì cả bộ điều khiển {device} tự về AUTO.', { device: controller.device_id })}
      </Text>

      <View style={styles.choices}>
        <ChoiceChip label={t('BẬT')} isSelected={targetState} onPress={() => setTargetState(true)} />
        <ChoiceChip label={t('TẮT')} isSelected={!targetState} onPress={() => setTargetState(false)} />
      </View>

      <Text variant="body" weight="semiBold">
        {t('Thời lượng')}
      </Text>
      <View style={styles.choices}>
        {options.map(option => (
          <ChoiceChip
            key={option}
            label={formatDuration(option)}
            isSelected={option === effectiveDuration}
            onPress={() => setDurationMs(option)}
          />
        ))}
      </View>

      {isPumpOn && blockingQuery.isLoading && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang kiểm tra cảnh báo của khu vực…')}
        </Text>
      )}
      {isPumpOn && blockingQuery.isError && (
        <View style={styles.retryRow}>
          <Text variant="small" weight="semiBold" color={palette.alert} style={styles.retryText}>
            {t('Không kiểm tra được cảnh báo của khu vực nên chưa bật được bơm. Vui lòng thử lại')}
          </Text>
          <Button
            variant="link"
            size="sm"
            label={t('Thử lại')}
            onPress={() => blockingQuery.refetch()}
            loading={blockingQuery.isFetching}
          />
        </View>
      )}
      {blockingAlerts.length > 0 && (
        <View style={[styles.warning, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" color={palette.alert}>
            {t('Khu vực đang có cảnh báo:')}
          </Text>
          {blockingAlerts.map(alert => (
            <Text key={alert._id} variant="small" numberOfLines={2}>
              {getAlertTypeLabel(alert.type) + ' · ' + getAlertStatusLabel(alert.status)}
            </Text>
          ))}
        </View>
      )}

      {errorMessage && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {errorMessage}
        </Text>
      )}
      {deliveryProblem === 'not-delivered' && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Máy chủ chưa kết nối được tới bộ điều khiển nên lệnh chưa được gửi. Thử lại sau ít phút')}
        </Text>
      )}
      {deliveryProblem === 'timed-out' && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Bộ điều khiển chưa phản hồi. Kiểm tra thiết bị còn online rồi thử lại')}
        </Text>
      )}
      {isWaiting && !isApplied && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang chờ bộ điều khiển chuyển sang điều khiển tay…')}
        </Text>
      )}

      <Button
        label={blockingAlerts.length > 0 ? t('Vẫn bật bơm') : t('Gửi lệnh')}
        onPress={handleSubmit}
        loading={controlRelay.isPending}
        disabled={controlRelay.isPending || isWaiting || isCheckingAlerts}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  warning: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  retryText: { flex: 1 },
})
