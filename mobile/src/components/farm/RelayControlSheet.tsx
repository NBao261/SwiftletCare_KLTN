import { useEffect, useState } from 'react'
import { Alert as NativeAlert, Pressable, StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { OVERRIDE_DEFAULT_MS, OVERRIDE_DURATION_OPTIONS_MS } from '@/constants/relayOverride'
import { Radius, Spacing } from '@/constants/theme'
import { useControlRelay } from '@/hooks/device/useControlRelay'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, RelayName, SensorNode } from '@/types'
import { getPumpOnBlockingAlerts } from '@/utils/alert.utils'
import { getRelayLabel } from '@/utils/label.utils'
import { clampOverrideDuration, formatDuration, getOverrideDurationLimits } from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

// Thời gian chờ controller báo đã chuyển trạng thái. ENV-FR-015 yêu cầu thay đổi relay hiện trong app ≤ 2 s; chờ gấp 5 lần
// để bù mạng di động chậm trước khi báo lỗi (hằng kỹ thuật của màn, không phải ngưỡng nghiệp vụ)
const RELAY_ACK_TIMEOUT_MS = 10 * 1000

interface RelayControlSheetProps {
  // Controller mới nhất trong cache (tải lại sau RELAY_UPDATE) để biết lệnh đã áp dụng chưa
  controller: SensorNode | null
  relay: RelayName | null
  zoneAlerts: Alert[]
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
// Bật bơm khi zone đang có cảnh báo cảm biến hỏng / phun sương không hiệu quả thì phải xác nhận
export function RelayControlSheet({ controller, relay, zoneAlerts, onClose }: RelayControlSheetProps) {
  const palette = usePalette()
  const controlRelay = useControlRelay()
  const currentState = controller && relay ? controller.relay_states[relay] : false
  const [targetState, setTargetState] = useState(!currentState)
  const [durationMs, setDurationMs] = useState(OVERRIDE_DEFAULT_MS)
  // Đã gửi lệnh, chờ controller báo đúng trạng thái
  const [isWaiting, setWaiting] = useState(false)
  // Lệnh không tới được controller: backend chưa nối broker, hoặc controller không báo lại trong thời gian chờ
  const [deliveryProblem, setDeliveryProblem] = useState<'not-delivered' | 'timed-out' | null>(null)

  const limits = relay ? getOverrideDurationLimits(relay, targetState) : null
  const options = limits ? OVERRIDE_DURATION_OPTIONS_MS.filter(option => option >= limits.minMs && option <= limits.maxMs) : []
  const effectiveDuration = limits ? clampOverrideDuration(durationMs, limits) : durationMs
  const blockingAlerts = relay === 'misting' && targetState ? getPumpOnBlockingAlerts(zoneAlerts) : []
  const isApplied = Boolean(
    controller && relay && controller.control_mode === 'MANUAL' && controller.relay_states[relay] === targetState,
  )

  // Controller đã chuyển MANUAL đúng trạng thái thì đóng sheet
  useEffect(() => {
    if (isWaiting && isApplied) onClose()
  }, [isWaiting, isApplied, onClose])

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

  const send = () => {
    setDeliveryProblem(null)
    controlRelay.mutate(
      { sensorNodeId: controller._id, relay, state: targetState, durationMs: effectiveDuration },
      {
        onSuccess: ({ isCommandDelivered }) => {
          setDeliveryProblem(isCommandDelivered ? null : 'not-delivered')
          setWaiting(isCommandDelivered)
        },
      },
    )
  }

  // TẮT và bật bơm khi có cảnh báo chặn đều hỏi lại trước khi gửi
  const handleSubmit = () => {
    if (blockingAlerts.length > 0) {
      NativeAlert.alert(t('Vẫn bật bơm?'), t('Zone đang có cảnh báo về cảm biến hoặc phun sương. Bơm có thể chạy không đúng.'), [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Vẫn bật bơm'), style: 'destructive', onPress: send },
      ])
      return
    }
    if (!targetState) {
      NativeAlert.alert(t('Tắt {relay}?', { relay: relayLabel }), t('{relay} sẽ tắt trong {duration} rồi tự về AUTO.', {
        relay: relayLabel,
        duration: formatDuration(effectiveDuration),
      }), [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Tắt'), onPress: send },
      ])
      return
    }
    send()
  }

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

      {blockingAlerts.length > 0 && (
        <View style={[styles.warning, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" color={palette.alert}>
            {t('Zone đang có cảnh báo:')}
          </Text>
          {blockingAlerts.map(alert => (
            <Text key={alert._id} variant="small" numberOfLines={2}>
              {alert.title}
            </Text>
          ))}
        </View>
      )}

      {controlRelay.isError && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {t('Không gửi được lệnh, thử lại')}
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
        disabled={controlRelay.isPending || isWaiting}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  warning: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
})
