import { useState } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated'
import { useEvent } from 'expo'
import { useVideoPlayer } from 'expo-video'
import {
  ArrowsOutIcon,
  CaretDownIcon,
  CaretUpIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PauseIcon,
  PlayIcon,
  VideoCameraIcon,
} from 'phosphor-react-native'
import { CameraControlColumn } from '@/components/farm/CameraControlColumn'
import { CameraFullscreenModal } from '@/components/farm/CameraFullscreenModal'
import { CellularPlaybackPrompt } from '@/components/farm/CellularPlaybackPrompt'
import { ZoomableView } from '@/components/common/ZoomableView'
import { CameraVideoSurface } from '@/components/home/CameraVideoSurface'
import { PlayerControlButton } from '@/components/home/PlayerControlButton'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAutoHideControls } from '@/hooks/device/useAutoHideControls'
import { useCameraAutoplay } from '@/hooks/device/useCameraAutoplay'
import { useCameraStreamUrl } from '@/hooks/device/useCameraStreamUrl'
import { useVideoZoom } from '@/hooks/device/useVideoZoom'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { usePalette } from '@/hooks/theme/usePalette'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import type { BirdCountToday, CameraNode } from '@/types'
import { formatBirdCountRows, getCameraStatusBadge, isForbiddenError } from '@/utils/camera.utils'
import { t } from '@/utils/i18n.utils'

// Thanh camera khi thu gọn: nhường chỗ cho cảm biến
const COLLAPSED_HEIGHT = 48
const ASPECT_RATIO = 9 / 16
const DOT_SIZE = 6
const PLAY_BUTTON_SIZE = 56

interface HouseCameraPanelProps {
  cameras: CameraNode[]
  today: BirdCountToday | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  // Màn đang hiện và không có sheet che: hết điều kiện này thì dừng luồng
  isActive: boolean
}

// Khung camera ghim đầu Màn B (VISION-FR-013): live stream đã vẽ khung chim, số chim hôm nay đè lên video,
// thu gọn được thành thanh 48 px, xem toàn màn xoay ngang; nhà có 2 cửa thì chọn camera
export function HouseCameraPanel({ cameras, today, isLoading, isError, onRetry, isActive }: HouseCameraPanelProps) {
  const palette = usePalette()
  const { width: windowWidth } = useWindowDimensions()
  const { userId, prefs } = useFarmPrefs()
  const setCameraCollapsed = useFarmPrefsStore(state => state.setCameraCollapsed)
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [isFullscreen, setFullscreen] = useState(false)

  // Camera online đứng trước để mặc định mở được ngay
  const sortedCameras = [...cameras].sort(
    (first, second) => Number(second.status === 'ONLINE') - Number(first.status === 'ONLINE'),
  )
  const camera = sortedCameras.find(item => item._id === selectedCameraId) ?? sortedCameras[0] ?? null
  const cameraIndex = camera ? cameras.findIndex(item => item._id === camera._id) : -1
  const isCollapsed = prefs.isCameraCollapsed
  const isOnline = camera?.status === 'ONLINE'
  const autoplay = useCameraAutoplay({ canPlay: isActive && !isCollapsed && isOnline })
  const streamQuery = useCameraStreamUrl(autoplay.shouldStream && camera ? camera._id : null)
  const player = useVideoPlayer(streamQuery.data ?? null, videoPlayer => {
    videoPlayer.muted = true
    videoPlayer.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  const countRows = formatBirdCountRows(today)
  // Chỉ tự ẩn khi đang phát; tạm dừng hoặc chưa có video thì giữ đến khi người dùng chạm khung
  const controls = useAutoHideControls(isPlaying)
  const zoom = useVideoZoom(controls.toggle)
  const frameWidth = windowWidth - Spacing.lg * 2
  const cameraName = camera ? t('Cửa {number}', { number: cameraIndex + 1 }) : t('Camera')

  const setCollapsed = (value: boolean) => {
    if (userId) setCameraCollapsed(userId, value)
  }

  if (isLoading) return <Skeleton width={frameWidth} height={frameWidth * ASPECT_RATIO} color={palette.inverse} />

  // Câu thay cho video khi không phát được; null là đang phát hoặc chờ người dùng chọn
  const getMessage = (): { text: string; onRetry?: () => void } | null => {
    if (isError) return { text: t('Không tải được camera'), onRetry }
    if (!camera) return { text: t('Nhà chưa lắp camera') }
    if (!isOnline) return { text: t('Camera mất kết nối'), onRetry }
    if (isForbiddenError(streamQuery.error)) return { text: t('Bạn không có quyền xem camera này') }
    if (streamQuery.isError || status === 'error') return { text: t('Không mở được luồng video'), onRetry: () => streamQuery.refetch() }
    return null
  }
  const message = getMessage()
  const isVideoLoading = autoplay.shouldStream && !message && status !== 'readyToPlay'
  // Đang có video: có nút phát/tạm dừng, và thanh điều khiển tự ẩn khi đang phát
  const hasVideo = autoplay.shouldStream && !message
  // Bấm nút trên thanh: chạy thao tác và giữ thanh hiện thêm một lúc
  const withControlsKept = (action: () => void) => () => {
    controls.keepVisible()
    action()
  }
  const statusText = camera ? getCameraStatusBadge(camera.status) : '_'

  if (isCollapsed) {
    return (
      <Animated.View layout={LinearTransition.reduceMotion(ReduceMotion.System)}>
        <Pressable
          style={[styles.collapsedBar, { backgroundColor: palette.inverse }]}
          onPress={() => setCollapsed(false)}
          accessibilityRole="button"
          accessibilityLabel={t('Mở rộng camera: {camera}, {status}', { camera: cameraName, status: statusText })}
        >
          <VideoCameraIcon size={20} color={palette.onInverse} />
          <Text variant="body" weight="semiBold" color={palette.onInverse} style={styles.flex} numberOfLines={1}>
            {`${cameraName} · ${statusText}`}
          </Text>
          <CaretDownIcon size={16} color={palette.onInverse} weight="bold" />
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <Animated.View
      layout={LinearTransition.reduceMotion(ReduceMotion.System)}
      style={[styles.frame, { width: frameWidth, height: frameWidth * ASPECT_RATIO, backgroundColor: palette.inverse }]}
    >
      {/* Video hoặc câu báo trạng thái; đang xem toàn màn thì khung toàn màn giữ player */}
      {!isFullscreen && (autoplay.shouldStream || message) && (
        <CameraVideoSurface
          player={player}
          message={message?.text ?? null}
          isLoading={isVideoLoading}
          onRetry={message?.onRetry}
          zoom={zoom}
        />
      )}
      {/* Đang hỏi dùng dữ liệu di động / chờ bấm phát: khung trống vẫn nhận chạm để hiện/ẩn thanh điều khiển */}
      {!autoplay.shouldStream && !message && <ZoomableView zoom={zoom} />}
      {!message && autoplay.isAskingCellular && (
        <CellularPlaybackPrompt onAllow={autoplay.allowCellular} onDecline={autoplay.declineCellular} />
      )}
      {/* Lớp mực mờ phủ khung khi thanh điều khiển hiện, như YouTube */}
      {!isFullscreen && (
        <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: palette.videoDim }, controls.animatedStyle]} />
      )}
      {!message && autoplay.isWaitingForPlay && (
        <View style={styles.center}>
          <PlayerControlButton icon={PlayIcon} label={t('Phát camera')} onPress={autoplay.playOnce} size={PLAY_BUTTON_SIZE} />
        </View>
      )}

      {/* Góc trên trái: trạng thái và số chim hôm nay; góc trên phải: thu gọn, toàn màn */}
      {camera && (
        <View style={styles.topLeft} pointerEvents="none">
          <View style={[styles.badge, { backgroundColor: palette.surface }]}>
            <View style={[styles.dot, { backgroundColor: isOnline ? palette.deviceOnline : palette.deviceOffline }]} />
            <Text variant="label" weight="bold">
              {statusText}
            </Text>
          </View>
          <Text variant="small" weight="bold" color={palette.primary} style={[styles.shadowText, { textShadowColor: palette.inverse }]}>
            {`${countRows.exitText} · ${countRows.entryText}`}
          </Text>
        </View>
      )}
      {/* Thanh điều khiển ở mọi trạng thái, kể cả khi chưa có camera: một cột dọc mép phải (thu gọn khung, phóng to,
          thu nhỏ, toàn màn hình), giữa phát/tạm dừng khi có video. Chạm khung để hiện/ẩn, tự ẩn sau 3 giây khi đang phát */}
      <Animated.View style={[styles.fill, controls.animatedStyle]} pointerEvents={controls.isVisible ? 'box-none' : 'none'}>
        <CameraControlColumn
          controls={[
            { icon: CaretUpIcon, label: t('Thu gọn camera'), onPress: () => setCollapsed(true) },
            { icon: MagnifyingGlassPlusIcon, label: t('Phóng to'), onPress: withControlsKept(zoom.zoomIn) },
            { icon: MagnifyingGlassMinusIcon, label: t('Thu nhỏ'), onPress: withControlsKept(zoom.zoomOut) },
            { icon: ArrowsOutIcon, label: t('Toàn màn hình'), onPress: withControlsKept(() => setFullscreen(true)) },
          ]}
        />
        {hasVideo && !isFullscreen && (
          <View style={styles.center} pointerEvents="box-none">
            <PlayerControlButton
              icon={isPlaying ? PauseIcon : PlayIcon}
              label={isPlaying ? t('Tạm dừng') : t('Phát')}
              onPress={withControlsKept(() => (isPlaying ? player.pause() : player.play()))}
              size={PLAY_BUTTON_SIZE}
            />
          </View>
        )}
      </Animated.View>

      {/* Nhà có 2 cửa: chọn camera, đang chọn thì nền lime */}
      {sortedCameras.length > 1 && (
        <View style={styles.bottomLeft}>
          {cameras.map((item, index) => {
            const isSelected = item._id === camera?._id
            return (
              <Pressable
                key={item._id}
                onPress={() => {
                  // Đổi camera thì trả zoom về 1
                  zoom.reset()
                  setSelectedCameraId(item._id)
                }}
                style={[styles.chip, { backgroundColor: isSelected ? palette.primary : palette.videoControlBackdrop }]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t('Cửa {number}', { number: index + 1 })}
              >
                <Text variant="label" weight="bold" color={isSelected ? palette.onPrimary : palette.onInverse}>
                  {t('Cửa {number}', { number: index + 1 })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <CameraFullscreenModal
        visible={isFullscreen}
        player={player}
        countRows={countRows}
        message={message?.text ?? null}
        onRetry={message?.onRetry}
        onClose={() => setFullscreen(false)}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: Radius.lg, overflow: 'hidden' },
  collapsedBar: {
    height: COLLAPSED_HEIGHT,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  flex: { flex: 1 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  topLeft: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, gap: Spacing.xs },
  bottomLeft: { position: 'absolute', bottom: Spacing.sm, left: Spacing.sm, flexDirection: 'row', gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  shadowText: { textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
})
