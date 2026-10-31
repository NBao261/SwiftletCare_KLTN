import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useEvent } from 'expo'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useVideoPlayer } from 'expo-video'
import {
  ArrowsInSimpleIcon,
  CornersInIcon,
  CornersOutIcon,
  GearSixIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  PauseIcon,
  PlayIcon,
  XIcon,
} from 'phosphor-react-native'
import { CameraMiniPlayer } from '@/components/home/CameraMiniPlayer'
import { CameraVideoSurface } from '@/components/home/CameraVideoSurface'
import { PlayerControlButton } from '@/components/home/PlayerControlButton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useLiveHouseBirdCount } from '@/hooks/bird-count/useLiveHouseBirdCount'
import type { CameraCardData } from '@/hooks/device/useCameraCards'
import { useCameraStreamUrl } from '@/hooks/device/useCameraStreamUrl'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatBirdCountRows, getCameraStatusBadge } from '@/utils/camera.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const VIDEO_ASPECT_RATIO = 16 / 9
const CENTER_BUTTON_SIZE = 64
// Cỡ nút của hàng điều khiển góc trên (PlayerControlButton mặc định) — bảng thông tin nằm ngay dưới hàng này
const CONTROL_ROW_HEIGHT = 36
const INFO_PANEL_MAX_WIDTH = 260
const STATUS_DOT_SIZE = 8
// Điều khiển tự ẩn sau 3 giây không chạm
const HUD_HIDE_DELAY_MS = 3000
const HUD_FADE_MS = 200
// Hai lần chạm cách nhau dưới khoảng này là chạm đúp
const DOUBLE_TAP_MS = 250
const FLASH_DURATION_MS = 800
// Vuốt xuống quá đoạn này thì thu nhỏ (dọc) hoặc thoát toàn màn (ngang)
const SWIPE_DOWN_DISTANCE = 100
const LIVE_ORIENTATIONS = ['portrait', 'landscape-left', 'landscape-right'] as const

type PlayerMode = 'expanded' | 'mini'
type FlashSide = 'left' | 'right'

interface LiveCameraPlayerProps {
  card: CameraCardData | null
  onClose: () => void
}

// Trình phát live kiểu YouTube, mở tại chỗ trên Trang chủ: khung phóng to (xoay ngang thì toàn màn) hoặc thanh mini nổi.
// Một player duy nhất cho mọi chế độ nên thu nhỏ, phóng to, xoay màn không phải kết nối lại luồng video
export function LiveCameraPlayer({ card, onClose }: LiveCameraPlayerProps) {
  const palette = usePalette()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [mode, setMode] = useState<PlayerMode>('expanded')
  // Đã bấm nút toàn màn thì giữ chiều đã chọn, không xoay theo cảm biến nữa
  const [isOrientationPinned, setOrientationPinned] = useState(false)
  const [isHudVisible, setHudVisible] = useState(true)
  // Khoá màn: ẩn mọi điều khiển, chạm chỉ hiện nút mở khoá
  const [isScreenLocked, setScreenLocked] = useState(false)
  const [isInfoOpen, setInfoOpen] = useState(false)
  const [flashSide, setFlashSide] = useState<FlashSide | null>(null)
  const lastTapAtRef = useRef(0)
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hudOpacity = useSharedValue(1)
  const swipeOffset = useSharedValue(0)

  const camera = card?.camera ?? null
  const isOnline = camera?.status === 'ONLINE'
  // Chỉ xin token khi camera đang online
  const streamQuery = useCameraStreamUrl(isOnline && camera ? camera._id : null)
  const player = useVideoPlayer(streamQuery.data ?? null, videoPlayer => {
    videoPlayer.muted = true
    videoPlayer.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  const today = useLiveHouseBirdCount(camera?.house_id ?? null)
  const { exitText, entryText } = formatBirdCountRows(today)

  const isExpanded = card !== null && mode === 'expanded'
  const isLandscape = isExpanded && windowWidth > windowHeight

  // Đang phóng to và chưa bấm nút toàn màn thì xoay theo cảm biến; còn lại giữ chiều dọc như cả app
  useEffect(() => {
    if (!isExpanded) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined)
      return
    }
    if (!isOrientationPinned) ScreenOrientation.unlockAsync().catch(() => undefined)
  }, [isExpanded, isOrientationPinned])

  // Đóng trình phát thì trả app về chiều dọc
  useEffect(
    () => () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined)
    },
    [],
  )

  // Điều khiển hiện rồi tự ẩn sau 3 giây, mờ dần; đang mở bảng thông tin thì giữ
  useEffect(() => {
    hudOpacity.set(withTiming(isHudVisible ? 1 : 0, { duration: HUD_FADE_MS }))
    if (!isHudVisible || isInfoOpen) return
    const timer = setTimeout(() => setHudVisible(false), HUD_HIDE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isHudVisible, isInfoOpen, hudOpacity])

  // Dấu hiệu chạm đúp chỉ hiện chốc lát
  useEffect(() => {
    if (!flashSide) return
    const timer = setTimeout(() => setFlashSide(null), FLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [flashSide])

  // Bỏ hẹn giờ chạm đơn khi đóng trình phát
  useEffect(() => () => clearTimeout(singleTapTimerRef.current), [])

  // Toàn màn: dọc thì khoá ngang, ngang thì khoá dọc
  const setFullscreen = (shouldEnter: boolean) => {
    setOrientationPinned(true)
    ScreenOrientation.lockAsync(
      shouldEnter ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => undefined)
  }

  // Thu nhỏ thành thanh mini; phóng to lại thì xoay theo cảm biến như lúc mới mở
  const minimize = () => {
    setInfoOpen(false)
    setOrientationPinned(false)
    setMode('mini')
  }

  // Vuốt xuống trên khung video: màn dọc thì thu nhỏ, màn ngang thì thoát toàn màn
  const swipeDownResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !isScreenLocked && gesture.dy > Spacing.md && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => swipeOffset.set(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          swipeOffset.set(withTiming(0, { duration: HUD_FADE_MS }))
          if (gesture.dy < SWIPE_DOWN_DISTANCE) return
          if (isLandscape) {
            setOrientationPinned(true)
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined)
          } else {
            setInfoOpen(false)
            setOrientationPinned(false)
            setMode('mini')
          }
        },
        onPanResponderTerminate: () => swipeOffset.set(withTiming(0, { duration: HUD_FADE_MS })),
      }),
    [isScreenLocked, isLandscape, swipeOffset],
  )

  const hudStyle = useAnimatedStyle(() => ({ opacity: hudOpacity.get() }))
  // Kéo xuống thì khung trượt theo tay và nhỏ dần
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: swipeOffset.get() }, { scale: 1 - Math.min(swipeOffset.get() / 1000, 0.2) }],
  }))

  if (!card || !camera) return null

  const title = `Camera ${camera.device_id}`
  const statusText = `${getCameraStatusBadge(camera.status)} · ${card.houseName}`
  const videoMessage = !isOnline
    ? t('Camera mất kết nối')
    : streamQuery.isError || status === 'error'
      ? t('Không mở được luồng video')
      : null
  const isVideoLoading = !videoMessage && status !== 'readyToPlay'
  const retryStream = isOnline ? () => streamQuery.refetch() : undefined
  const togglePlay = () => (isPlaying ? player.pause() : player.play())
  // Màn dọc: khung 16:9 giữa màn rộng trừ lề; màn ngang: phủ toàn màn
  const frameWidth = isLandscape ? windowWidth : windowWidth - Spacing.lg * 2

  // Chạm một lần: hiện/ẩn điều khiển; chạm đúp nửa trái/phải: luồng trực tiếp không tua được nên chỉ báo hiệu
  const handleCanvasPress = (event: GestureResponderEvent) => {
    const now = Date.now()
    if (now - lastTapAtRef.current < DOUBLE_TAP_MS) {
      clearTimeout(singleTapTimerRef.current)
      lastTapAtRef.current = 0
      if (!isScreenLocked) setFlashSide(event.nativeEvent.locationX < frameWidth / 2 ? 'left' : 'right')
      return
    }
    lastTapAtRef.current = now
    singleTapTimerRef.current = setTimeout(() => setHudVisible(visible => !visible), DOUBLE_TAP_MS)
  }

  if (mode === 'mini') {
    return (
      <CameraMiniPlayer
        player={player}
        title={title}
        statusText={statusText}
        isOnline={isOnline}
        isPlaying={isPlaying}
        message={videoMessage}
        isLoading={isVideoLoading}
        onTogglePlay={togglePlay}
        onExpand={() => setMode('expanded')}
        onClose={onClose}
      />
    )
  }

  const frameStyle = isLandscape
    ? { width: windowWidth, height: windowHeight }
    : { width: frameWidth, aspectRatio: VIDEO_ASPECT_RATIO, borderRadius: Radius.lg }
  const areControlsActive = isHudVisible && !isScreenLocked
  const shadowStyle = { textShadowColor: palette.inverse }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={[...LIVE_ORIENTATIONS]}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: isLandscape ? palette.inverse : palette.secondary }]}>
        <Animated.View
          style={[styles.frame, frameStyle, { backgroundColor: palette.inverse }, swipeStyle]}
          {...swipeDownResponder.panHandlers}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCanvasPress} accessible={false}>
            <CameraVideoSurface player={player} message={videoMessage} isLoading={isVideoLoading} onRetry={retryStream} />
          </Pressable>

          {/* Lớp mực mờ phủ video khi điều khiển hiện, như thanh điều khiển của YouTube */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: palette.videoDim }, isScreenLocked ? styles.hidden : hudStyle]}
          />

          {/* Số đếm chim: luôn ở góc trên trái, không nền, chữ lime có bóng */}
          <View style={styles.counts} pointerEvents="none" accessible accessibilityLabel={`${exitText}, ${entryText}`}>
            <Text variant="body" weight="bold" color={palette.primary} style={[styles.shadowText, shadowStyle]}>
              {exitText}
            </Text>
            <Text variant="body" weight="bold" color={palette.primary} style={[styles.shadowText, shadowStyle]}>
              {entryText}
            </Text>
          </View>

          {/* Điều khiển: góc trên phải, nút giữa, hàng dưới — ẩn hẳn khi khoá màn */}
          {!isScreenLocked && (
            <Animated.View
              style={[StyleSheet.absoluteFill, hudStyle]}
              pointerEvents={areControlsActive ? 'box-none' : 'none'}
            >
              <View style={styles.topRight}>
                <PlayerControlButton icon={GearSixIcon} label={t('Thông tin luồng video')} onPress={() => setInfoOpen(open => !open)} />
                <PlayerControlButton
                  icon={LockSimpleIcon}
                  label={t('Khoá màn hình')}
                  onPress={() => {
                    setInfoOpen(false)
                    setScreenLocked(true)
                    setHudVisible(false)
                  }}
                />
                <PlayerControlButton icon={ArrowsInSimpleIcon} label={t('Thu nhỏ thành thanh nổi')} onPress={minimize} />
                <PlayerControlButton icon={XIcon} label={t('Đóng camera')} onPress={onClose} />
              </View>

              {!videoMessage && (
                <View style={styles.center} pointerEvents="box-none">
                  <PlayerControlButton
                    icon={isPlaying ? PauseIcon : PlayIcon}
                    label={isPlaying ? t('Tạm dừng') : t('Phát')}
                    onPress={togglePlay}
                    size={CENTER_BUTTON_SIZE}
                  />
                </View>
              )}

              <View style={styles.bottomRow} pointerEvents="box-none">
                <View style={styles.liveBadge}>
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? palette.primary : palette.deviceOffline }]} />
                  <Text variant="label" weight="bold" color={palette.onInverse} numberOfLines={1} style={[styles.shadowText, shadowStyle]}>
                    {statusText}
                  </Text>
                </View>
                <PlayerControlButton
                  icon={isLandscape ? CornersInIcon : CornersOutIcon}
                  label={isLandscape ? t('Thoát toàn màn hình') : t('Toàn màn hình ngang')}
                  onPress={() => setFullscreen(!isLandscape)}
                />
              </View>
            </Animated.View>
          )}

          {/* Khoá màn: chạm vào video chỉ hiện nút mở khoá, cũng tự ẩn sau 3 giây */}
          {isScreenLocked && (
            <Animated.View style={[styles.center, hudStyle]} pointerEvents={isHudVisible ? 'box-none' : 'none'}>
              <PlayerControlButton
                icon={LockSimpleOpenIcon}
                label={t('Mở khoá màn hình')}
                onPress={() => {
                  setScreenLocked(false)
                  setHudVisible(true)
                }}
                size={CENTER_BUTTON_SIZE}
              />
            </Animated.View>
          )}

          {/* Chạm đúp: luồng trực tiếp không có lịch sử để tua */}
          {flashSide && (
            <View style={[styles.flash, flashSide === 'left' ? styles.flashLeft : styles.flashRight]} pointerEvents="none">
              <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.videoFlashBackdrop }]} />
              <Text variant="small" weight="semiBold" color={palette.onInverse}>
                {t('Đang phát trực tiếp · không tua được')}
              </Text>
            </View>
          )}

          {/* Bảng thông tin luồng (nút bánh răng): chưa có lựa chọn chất lượng vì máy chủ chỉ phát một luồng HLS */}
          {isInfoOpen && !isScreenLocked && (
            <View style={styles.infoPanel}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.videoInfoBackdrop }]} />
              {[
                t('Chất lượng: Tự động'),
                `Camera: ${camera.device_id}`,
                t('Nhà: {house}', { house: card.houseName }),
                t('Mô hình AI: {model}', { model: camera.model_version ?? '_' }),
                t('Tín hiệu gần nhất: {time}', { time: camera.last_heartbeat ? formatTimeAgo(camera.last_heartbeat) : '_' }),
              ].map(line => (
                <Text key={line} variant="small" color={palette.onInverse} numberOfLines={1}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Khung video nằm giữa màn, cả khi dọc lẫn khi ngang
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { overflow: 'hidden' },
  hidden: { opacity: 0 },
  counts: { position: 'absolute', top: Spacing.md, left: Spacing.md, gap: Spacing.xs },
  shadowText: { textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  topRight: { position: 'absolute', top: Spacing.md, right: Spacing.md, flexDirection: 'row', gap: Spacing.sm },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  liveBadge: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: STATUS_DOT_SIZE, height: STATUS_DOT_SIZE, borderRadius: Radius.full },
  flash: {
    position: 'absolute',
    top: '45%',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  flashLeft: { left: Spacing.lg },
  flashRight: { right: Spacing.lg },
  infoPanel: {
    position: 'absolute',
    top: Spacing.md + CONTROL_ROW_HEIGHT + Spacing.sm,
    right: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    overflow: 'hidden',
    maxWidth: INFO_PANEL_MAX_WIDTH,
  },
})
