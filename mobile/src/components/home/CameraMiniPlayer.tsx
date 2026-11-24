import { useMemo } from 'react'
import { PanResponder, Pressable, StyleSheet, View } from 'react-native'
import type { VideoPlayer } from 'expo-video'
import { PauseIcon, PlayIcon, XIcon } from 'phosphor-react-native'
import { CameraVideoSurface } from '@/components/home/CameraVideoSurface'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const THUMBNAIL_WIDTH = 96
const VIDEO_ASPECT_RATIO = 16 / 9
const STATUS_DOT_SIZE = 6
// Vuốt lên quá đoạn này thì phóng to lại
const SWIPE_UP_DISTANCE = 24

interface CameraMiniPlayerProps {
  player: VideoPlayer
  title: string
  statusText: string
  isOnline: boolean
  isPlaying: boolean
  message: string | null
  isLoading: boolean
  onTogglePlay: () => void
  onExpand: () => void
  onClose: () => void
}

// Thanh mini-player nổi trên Trang chủ: video nhỏ bên trái, tên + trạng thái ở giữa, phát/tạm dừng và đóng bên phải.
// Bấm hoặc vuốt lên thì phóng to lại
export function CameraMiniPlayer({
  player,
  title,
  statusText,
  isOnline,
  isPlaying,
  message,
  isLoading,
  onTogglePlay,
  onExpand,
  onClose,
}: CameraMiniPlayerProps) {
  const palette = usePalette()

  const swipeUpResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -Spacing.sm && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -SWIPE_UP_DISTANCE) onExpand()
        },
      }),
    [onExpand],
  )

  return (
    <View
      style={[styles.bar, { backgroundColor: palette.surface, bottom: TAB_BAR_OVERLAP + Spacing.md }]}
      {...swipeUpResponder.panHandlers}
    >
      <Pressable style={styles.main} onPress={onExpand} accessibilityRole="button" accessibilityLabel={t('{title}, bấm để phóng to', { title })}>
        <View style={[styles.thumbnail, { backgroundColor: palette.inverse }]}>
          <CameraVideoSurface player={player} message={message} isLoading={isLoading} isCompact />
        </View>
        <View style={styles.texts}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? palette.primary : palette.deviceOffline }]} />
            <Text variant="small" color={palette.textSecondary} numberOfLines={1} style={styles.statusText}>
              {statusText}
            </Text>
          </View>
        </View>
      </Pressable>
      <IconButton icon={isPlaying ? PauseIcon : PlayIcon} label={isPlaying ? t('Tạm dừng') : t('Phát')} onPress={onTogglePlay} />
      <IconButton icon={XIcon} label={t('Đóng camera')} onPress={onClose} />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumbnail: { width: THUMBNAIL_WIDTH, aspectRatio: VIDEO_ASPECT_RATIO, borderRadius: Radius.sm, overflow: 'hidden' },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: STATUS_DOT_SIZE, height: STATUS_DOT_SIZE, borderRadius: Radius.full },
  statusText: { flexShrink: 1 },
})
