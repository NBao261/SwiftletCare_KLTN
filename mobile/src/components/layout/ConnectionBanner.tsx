import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckIcon, WifiSlashIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useConnectionStatus, type ConnectionStatus } from '@/hooks/network/useConnectionStatus'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Câu "Đã kết nối lại" hiện bao lâu rồi tự ẩn
const RECONNECTED_VISIBLE_MS = 2000

function getMessage(status: ConnectionStatus): string {
  if (status === 'offline') return t('Mất kết nối mạng. Dữ liệu đang hiện có thể đã cũ')
  if (status === 'server-lost') return t('Mất kết nối máy chủ, đang kết nối lại…')
  return t('Đã kết nối lại')
}

// Viên báo kết nối nổi ngay dưới thanh trạng thái, trên mọi màn: mất mạng, mất máy chủ, rồi "Đã kết nối lại" 2 giây.
// Không chặn chạm (pointerEvents none) nên nút ở header bên dưới vẫn bấm được
export function ConnectionBanner() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const status = useConnectionStatus()
  const [trackedStatus, setTrackedStatus] = useState(status)
  const [isReconnectedVisible, setReconnectedVisible] = useState(false)
  // Từ mất kết nối về bình thường thì hiện "Đã kết nối lại" một lúc — đặt ngay trong lúc dựng khi trạng thái đổi
  if (status !== trackedStatus) {
    setTrackedStatus(status)
    setReconnectedVisible(status === 'online')
  }

  useEffect(() => {
    if (!isReconnectedVisible) return
    const timer = setTimeout(() => setReconnectedVisible(false), RECONNECTED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [isReconnectedVisible])

  if (status === 'online' && !isReconnectedVisible) return null
  const isOnline = status === 'online'
  const Icon = isOnline ? CheckIcon : WifiSlashIcon

  return (
    <View pointerEvents="none" style={[styles.container, { top: insets.top + Spacing.xs }]}>
      <Animated.View
        key={status}
        entering={FadeInUp}
        exiting={FadeOutUp}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.pill, { backgroundColor: palette.inverse }]}
      >
        <Icon size={16} color={isOnline ? palette.primary : palette.onInverse} weight="bold" />
        <Text variant="small" weight="semiBold" color={palette.onInverse} numberOfLines={2} style={styles.message}>
          {getMessage(status)}
        </Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  message: { flexShrink: 1 },
})
