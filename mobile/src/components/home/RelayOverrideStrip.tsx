import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { CaretRightIcon, DropIcon, FanIcon, SpeakerHighIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useActiveRelayOverrides, type ActiveRelayOverride } from '@/hooks/device/useActiveRelayOverrides'
import { useClearRelayOverride } from '@/hooks/device/useClearRelayOverride'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import type { RelayName } from '@/types'
import { getRelayLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { formatRemainingTime } from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

const ICON_CIRCLE_SIZE = 40
// Cập nhật chữ "còn … phút" mỗi 30 giây
const COUNTDOWN_INTERVAL_MS = 30 * 1000

// Icon theo loại relay: bơm phun sương → giọt nước, quạt → quạt, loa → loa
function RelayIcon({ relay, color }: { relay: RelayName; color: string }) {
  if (relay === 'ventilation') return <FanIcon size={20} color={color} weight="bold" />
  if (relay === 'speaker') return <SpeakerHighIcon size={20} color={color} weight="bold" />
  return <DropIcon size={20} color={color} weight="bold" />
}

// Dòng phụ: controller mất kết nối thì báo ngay; còn lại là lệnh bật/tắt kèm thời gian còn lại
function getOverrideCaption({ log, node }: ActiveRelayOverride, now: number): string {
  if (node.status !== 'ONLINE') return t('Controller mất kết nối')
  const action = log.state ? t('Chạy thủ công') : t('Tắt thủ công')
  // Hết giờ: chờ server xác nhận đã về tự động, không tự cho là đã về
  return `${action}, ${formatRemainingTime(log.expires_at, now) ?? t('đang trả về tự động')}`
}

// Dải relay đang chạy thủ công: một relay thì có nút "Về tự động", từ hai relay thì chỉ báo số lượng; không có thì ẩn
export function RelayOverrideStrip() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const queryClient = useQueryClient()
  const now = useNow(COUNTDOWN_INTERVAL_MS)
  const { overrides } = useActiveRelayOverrides()
  const { zoneById } = useZoneDirectory()
  const clearOverride = useClearRelayOverride()

  // Có relay đã quá giờ hết hạn thì hỏi lại server; controller trả relay về tự động trong khoảng 10 giây
  const hasExpiredOverride = overrides.some(({ log }) => new Date(log.expires_at).getTime() <= now)
  useEffect(() => {
    if (hasExpiredOverride) queryClient.invalidateQueries({ queryKey: ['devices'] })
  }, [hasExpiredOverride, now, queryClient])

  if (overrides.length === 0) return null

  if (overrides.length > 1) {
    return (
      <Card
        tone="inverse"
        style={styles.strip}
        // shortcut: chưa có màn danh sách relay thủ công — tạm mở tab Trang trại
        onPress={() => router.navigate('/(tabs)/farms')}
        accessibilityLabel={t('{count} relay đang chạy thủ công', { count: overrides.length })}
      >
        <Text variant="body" weight="semiBold" color={palette.onInverse} style={styles.texts}>
          {t('{count} relay đang chạy thủ công', { count: overrides.length })}
        </Text>
        <CaretRightIcon size={16} color={palette.onInverseSecondary} />
      </Card>
    )
  }

  const [override] = overrides
  const zoneName = zoneById.get(override.log.zone_id)?.name ?? '_'
  const title = `${getRelayLabel(override.log.relay)} · ${zoneName}`
  const caption = getOverrideCaption(override, now)
  // Lệnh gửi tới controller mất kết nối quá 60 giây sẽ không được áp dụng nên khoá nút
  const isActionDisabled = override.node.status !== 'ONLINE' || clearOverride.isPending

  return (
    <Card tone="inverse" style={styles.strip}>
      <View style={[styles.iconCircle, { backgroundColor: palette.primary }]}>
        <RelayIcon relay={override.log.relay} color={palette.onPrimary} />
      </View>
      <View style={styles.texts} accessible accessibilityLabel={`${title}, ${caption}`}>
        <Text variant="body" weight="semiBold" color={palette.onInverse} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" color={palette.onInverseSecondary} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      {/* Chỉ Farm Owner trả relay về tự động; chuyên gia chỉ xem */}
      {canPerform(user, 'clearRelayOverride') && (
        <Button
          label={t('VỀ TỰ ĐỘNG')}
          size="sm"
          onPress={() => clearOverride.mutate(override.node._id)}
          disabled={isActionDisabled}
          accessibilityLabel={t('Về tự động: {title}', { title })}
        />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
