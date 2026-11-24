import { useEffect, useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Text } from '@/components/ui/text'
import { OVERRIDE_DEFAULT_MS, OVERRIDE_DURATION_OPTIONS_MS } from '@/constants/relayOverride'
import { Radius, Spacing } from '@/constants/theme'
import { usePumpBlockingAlerts } from '@/hooks/alert/usePumpBlockingAlerts'
import { useRelayCommand } from '@/hooks/device/useRelayCommand'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, RelayName, SensorNode } from '@/types'
import { getAlertStatusLabel, getAlertTypeLabel, getRelayLabel } from '@/utils/label.utils'
import { clampOverrideDuration, formatDuration, getOverrideDurationLimits } from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

interface RelayControlSheetProps {
  // Controller mới nhất trong cache (tải lại sau RELAY_UPDATE) để biết lệnh đã áp dụng chưa
  controller: SensorNode | null
  relay: RelayName | null
  onClose: () => void
}

// Sheet điều khiển tay một relay (ENV-FR-016): BẬT/TẮT, thời lượng theo BR-08, hết giờ relay đó tự về AUTO (BR-20).
// Bật bơm khi khu vực đang có cảnh báo cảm biến hỏng / phun sương không hiệu quả (mới hoặc đã xác nhận) thì phải xác nhận;
// sheet tự tải mới các cảnh báo đó mỗi lần mở, chưa tải xong thì chưa cho gửi
export function RelayControlSheet({ controller, relay, onClose }: RelayControlSheetProps) {
  const palette = usePalette()
  const currentState = controller && relay ? controller.relay_states[relay] : false
  const [targetState, setTargetState] = useState(!currentState)
  const [durationMs, setDurationMs] = useState(OVERRIDE_DEFAULT_MS)

  const limits = relay ? getOverrideDurationLimits(relay, targetState) : null
  const options = limits ? OVERRIDE_DURATION_OPTIONS_MS.filter(option => option >= limits.minMs && option <= limits.maxMs) : []
  const effectiveDuration = limits ? clampOverrideDuration(durationMs, limits) : durationMs
  const isPumpOn = relay === 'misting' && targetState
  const blockingQuery = usePumpBlockingAlerts(controller?.zone_id ?? '', isPumpOn)
  const blockingAlerts: Alert[] = isPumpOn ? (blockingQuery.data ?? []) : []
  // Bật bơm mà chưa biết khu vực có cảnh báo chặn hay không thì chưa cho gửi
  const isCheckingAlerts = isPumpOn && (blockingQuery.isLoading || blockingQuery.isError)
  const command = useRelayCommand(controller, relay, { onConfirmationRequired: () => void blockingQuery.refetch() })

  // Controller đã chuyển MANUAL đúng trạng thái thì đóng sheet
  useEffect(() => {
    if (command.hasApplied) onClose()
  }, [command.hasApplied, onClose])

  if (!controller || !relay) return null
  const relayLabel = getRelayLabel(relay)

  // TẮT và bật bơm khi có cảnh báo chặn đều hỏi lại trước khi gửi
  const handleSubmit = () => {
    if (isCheckingAlerts) return
    if (blockingAlerts.length > 0) {
      command.confirmPumpOn(blockingAlerts, effectiveDuration)
      return
    }
    if (!targetState) {
      NativeAlert.alert(t('Tắt {relay}?', { relay: relayLabel }), t('{relay} sẽ tắt trong {duration} rồi quay về chế độ tự động.', {
        relay: relayLabel,
        duration: formatDuration(effectiveDuration),
      }), [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Tắt'), onPress: () => command.send(false, effectiveDuration) },
      ])
      return
    }
    command.send(true, effectiveDuration)
  }

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{t('Điều khiển tay: {relay}', { relay: relayLabel })}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Hết thời lượng sẽ tự quay về chế độ tự động')}
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

      {command.errorMessage && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {command.errorMessage}
        </Text>
      )}
      {command.deliveryProblem === 'not-delivered' && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Máy chủ chưa kết nối được tới bộ điều khiển nên lệnh chưa được gửi. Thử lại sau ít phút')}
        </Text>
      )}
      {command.deliveryProblem === 'timed-out' && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Bộ điều khiển chưa phản hồi. Kiểm tra thiết bị còn online rồi thử lại')}
        </Text>
      )}
      {command.isWaiting && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang chờ bộ điều khiển chuyển sang điều khiển tay…')}
        </Text>
      )}

      <Button
        label={blockingAlerts.length > 0 ? t('Vẫn bật bơm') : t('Gửi lệnh')}
        onPress={handleSubmit}
        loading={command.isSending}
        disabled={command.isSending || command.isWaiting || isCheckingAlerts}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  warning: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  retryText: { flex: 1 },
})
