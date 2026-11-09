import { useEffect } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'
import type { VideoPlayer } from 'expo-video'
import Animated from 'react-native-reanimated'
import { useEvent } from 'expo'
import {
  ArrowsInIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PauseIcon,
  PlayIcon,
} from 'phosphor-react-native'
import { CameraControlColumn } from '@/components/farm/CameraControlColumn'
import { CameraVideoSurface } from '@/components/home/CameraVideoSurface'
import { PlayerControlButton } from '@/components/home/PlayerControlButton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useAutoHideControls } from '@/hooks/device/useAutoHideControls'
import { useVideoZoom } from '@/hooks/device/useVideoZoom'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Nút phát/tạm dừng giữa màn, cùng cỡ khung camera ở Màn B
const PLAY_BUTTON_SIZE = 56

interface CameraFullscreenModalProps {
  visible: boolean
  // Cùng player với khung nhỏ để không phải kết nối lại
  player: VideoPlayer
  countRows: { exitText: string; entryText: string }
  // Chưa có video (chưa lắp camera, mất kết nối…) thì hiện câu này thay video
  message: string | null
  onRetry?: () => void
  onClose: () => void
}

// Xem camera toàn màn hình, xoay ngang; đóng thì khoá lại chiều dọc như cả app
export function CameraFullscreenModal({
  visible,
  player,
  countRows,
  message,
  onRetry,
  onClose,
}: CameraFullscreenModalProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const shadowStyle = { textShadowColor: palette.inverse }
  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  })
  const controls = useAutoHideControls(isPlaying)
  const zoom = useVideoZoom(controls.toggle)
  // Bấm nút trên thanh: chạy thao tác và giữ thanh hiện thêm một lúc
  const keepControls = (action: () => void) => () => {
    controls.keepVisible()
    action()
  }

  useEffect(() => {
    if (!visible) return
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined)
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined)
    }
  }, [visible])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={['landscape', 'portrait']}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Modal là cây giao diện riêng: cử chỉ chỉ chạy khi có GestureHandlerRootView trong đó */}
      <GestureHandlerRootView style={[styles.screen, { backgroundColor: palette.inverse }]}>
        <View style={styles.videoFrame}>
          <CameraVideoSurface player={player} message={message} isLoading={false} onRetry={onRetry} zoom={zoom} />
        </View>
        {/* Số đếm không nền, chữ lime có viền bóng để đọc được trên mọi khung hình */}
        <View
          style={[styles.counts, { top: insets.top + Spacing.lg, left: insets.left + Spacing.lg }]}
          pointerEvents="none"
        >
          <Text variant="body" weight="bold" color={palette.primary} style={[styles.shadowText, shadowStyle]}>
            {countRows.exitText}
          </Text>
          <Text variant="body" weight="bold" color={palette.primary} style={[styles.shadowText, shadowStyle]}>
            {countRows.entryText}
          </Text>
        </View>
        {/* Lớp mờ và thanh điều khiển kiểu YouTube: chạm video để hiện/ẩn, tự ẩn sau 3 giây khi đang phát */}
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: palette.videoDim }, controls.animatedStyle]}
        />
        <Animated.View
          style={[styles.fill, controls.animatedStyle]}
          pointerEvents={controls.isVisible ? 'box-none' : 'none'}
        >
          {/* Cùng cột nút với khung camera ở Màn B; cộng vùng an toàn bên phải khi xoay ngang */}
          <CameraControlColumn
            style={{ right: insets.right + Spacing.lg }}
            controls={[
              { icon: MagnifyingGlassPlusIcon, label: t('Phóng to'), onPress: keepControls(zoom.zoomIn) },
              { icon: MagnifyingGlassMinusIcon, label: t('Thu nhỏ'), onPress: keepControls(zoom.zoomOut) },
              // Cuối cột, đúng chỗ nút Toàn màn hình ở khung nhỏ: bấm vào và bấm ra cùng một vị trí
              { icon: ArrowsInIcon, label: t('Thoát toàn màn hình'), onPress: onClose },
            ]}
          />
          {!message && (
            <View style={styles.center} pointerEvents="box-none">
              <PlayerControlButton
                icon={isPlaying ? PauseIcon : PlayIcon}
                label={isPlaying ? t('Tạm dừng') : t('Phát')}
                onPress={() => {
                  controls.keepVisible()
                  if (isPlaying) player.pause()
                  else player.play()
                }}
                size={PLAY_BUTTON_SIZE}
              />
            </View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  counts: { position: 'absolute', gap: Spacing.xs },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cắt phần video thừa khi phóng to
  videoFrame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  shadowText: {
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
