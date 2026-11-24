import { Alert as NativeAlert, Pressable, StyleSheet, View } from 'react-native'
import { RelayIcon } from '@/components/common/RelayIcon'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text'
import { OVERRIDE_DEFAULT_MS } from '@/constants/relayOverride'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useClearRelayOverride } from '@/hooks/device/useClearRelayOverride'
import { useRelayCommand } from '@/hooks/device/useRelayCommand'
import { usePalette } from '@/hooks/theme/usePalette'
import type { RelayName, SensorNode } from '@/types'
import { getControlModeLabel, getRelayLabel } from '@/utils/label.utils'
import {
  clampOverrideDuration,
  formatClockTime,
  formatDuration,
  getOverrideDurationLimits,
  getRelayExpiry,
  getRelayMode,
} from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

const ICON_CIRCLE_SIZE = 36

interface RelayRowProps {
  controller: SensorNode
  relay: RelayName
  // % công suất do bộ điều khiển fuzzy tính (chỉ phun sương, quạt); chưa có thì null
  powerText: string | null
  // Dòng phụ khi relay đang AUTO: khung giờ loa ru, "Phun sương không hiệu quả"
  extraText: string | null
  isExtraAlert: boolean
  // Role được điều khiển tay (Farm Owner): luôn thấy nút gạt, controller không ONLINE thì nút mờ và khoá
  canControl: boolean
  canClear: boolean
  // Chạm tên relay: mở sheet để chọn thời lượng khác
  onOpenSheet: () => void
}

// Một dòng relay: icon, tên, chế độ của chính relay (BR-20) và nút gạt BẬT/TẮT gửi lệnh ngay với thời lượng mặc định
// 30 phút (bơm tối đa 30 phút, BR-08). TẮT hỏi lại một lần; bật bơm lúc khu vực có cảnh báo chặn thì backend trả 409 và hỏi
// xác nhận (ENV-FR-016). Relay đang điều khiển tay có nút "Về AUTO" riêng
export function RelayRow({
  controller,
  relay,
  powerText,
  extraText,
  isExtraAlert,
  canControl,
  canClear,
  onOpenSheet,
}: RelayRowProps) {
  const palette = usePalette()
  const command = useRelayCommand(controller, relay)
  const clearOverride = useClearRelayOverride()
  const relayLabel = getRelayLabel(relay)
  const actualState = controller.relay_states[relay]
  const shownState = command.pendingState ?? actualState
  const expiry = getRelayExpiry(controller, relay)
  const isManual = getRelayMode(controller, relay) === 'MANUAL'
  const isOnline = controller.status === 'ONLINE'
  const isBusy = command.isSending || command.isWaiting
  // Gửi lệnh được: đúng role và controller đang ONLINE
  const isControllable = canControl && isOnline

  const handleToggle = (nextState: boolean) => {
    const durationMs = clampOverrideDuration(OVERRIDE_DEFAULT_MS, getOverrideDurationLimits(relay, nextState))
    if (nextState) {
      command.send(true, durationMs)
      return
    }
    NativeAlert.alert(
      t('Tắt {relay}?', { relay: relayLabel }),
      t('{relay} sẽ tắt trong {duration} rồi quay về chế độ tự động.', { relay: relayLabel, duration: formatDuration(durationMs) }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Tắt'), onPress: () => command.send(false, durationMs) },
      ],
    )
  }

  const confirmClear = () =>
    NativeAlert.alert(
      t('Trả {relay} về AUTO?', { relay: relayLabel }),
      t('{relay} của bộ điều khiển {device} sẽ quay về chế độ tự động ngay, thiết bị khác giữ nguyên.', {
        relay: relayLabel,
        device: controller.device_id,
      }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        { text: t('Trả về AUTO'), onPress: () => clearOverride.mutate({ sensorNodeId: controller._id, relayName: relay }) },
      ],
    )

  const stateText = [shownState ? t('BẬT') : t('TẮT'), powerText].filter(Boolean).join(' · ')
  const subText = isManual
    ? [getControlModeLabel('MANUAL'), expiry ? t('tự động lại lúc {time}', { time: formatClockTime(expiry) }) : null]
        .filter(Boolean)
        .join(' · ')
    : extraText
  const problemText =
    command.errorMessage ??
    (command.deliveryProblem === 'not-delivered'
      ? t('Máy chủ chưa kết nối được tới bộ điều khiển nên lệnh chưa được gửi. Thử lại sau ít phút')
      : command.deliveryProblem === 'timed-out'
        ? t('Bộ điều khiển chưa phản hồi. Kiểm tra thiết bị còn online rồi thử lại')
        : clearOverride.isError
          ? t('Không gửi được lệnh, thử lại')
          : null)

  return (
    <View style={[styles.row, { borderTopColor: palette.divider }]}>
      <View style={styles.main}>
        <Pressable
          style={styles.info}
          onPress={isControllable ? onOpenSheet : undefined}
          disabled={!isControllable}
          accessibilityRole={isControllable ? 'button' : undefined}
          accessibilityLabel={[relayLabel, stateText, subText].filter(Boolean).join(', ')}
          accessibilityHint={isControllable ? t('Mở điều khiển tay để chọn thời lượng') : undefined}
        >
          <View style={[styles.iconCircle, { backgroundColor: shownState ? palette.primary : palette.surfaceStrong }]}>
            <RelayIcon relay={relay} color={shownState ? palette.onPrimary : palette.textSecondary} />
          </View>
          <View style={styles.texts}>
            <Text variant="body" weight="semiBold" numberOfLines={1}>
              {relayLabel}
            </Text>
            {subText && (
              <Text
                variant="small"
                color={isManual || isExtraAlert ? palette.alert : palette.textSecondary}
                numberOfLines={1}
              >
                {subText}
              </Text>
            )}
          </View>
        </Pressable>
        {canControl ? (
          <View style={styles.control}>
            {powerText && (
              <Text variant="small" weight="semiBold" color={palette.textSecondary}>
                {powerText}
              </Text>
            )}
            <Switch
              value={shownState}
              onValueChange={handleToggle}
              disabled={!isOnline}
              isPending={isBusy}
              accessibilityLabel={relayLabel}
            />
          </View>
        ) : (
          <Text variant="body" weight="semiBold">
            {stateText}
          </Text>
        )}
      </View>
      {isManual && canClear && (
        <Button
          label={t('Về AUTO')}
          variant="link"
          size="sm"
          onPress={confirmClear}
          loading={clearOverride.isPending}
          disabled={!isOnline || clearOverride.isPending || isBusy}
          style={styles.clearButton}
        />
      )}
      {problemText && (
        <Text variant="small" weight="semiBold" color={palette.alert}>
          {problemText}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: BorderWidth.hairline },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  info: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  control: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: { alignSelf: 'flex-start', marginLeft: ICON_CIRCLE_SIZE + Spacing.md },
})
