import type { LayoutChangeEvent } from 'react-native'
import {
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler'
import { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Phóng to tối đa 4 lần; nút +/- mỗi lần 1 bậc; chạm đúp phóng 2 lần hoặc trả về 1 — thông số giao diện
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1
const DOUBLE_TAP_ZOOM = 2
const TIMING = { duration: 200, reduceMotion: ReduceMotion.System }

// Giới hạn một số trong khoảng [min, max]
function clamp(value: number, min: number, max: number): number {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

// Phóng to / thu nhỏ video: chụm hai ngón để zoom, kéo để di chuyển khi đang phóng to, chạm đúp để bật/tắt zoom,
// và hàm cho nút +/-. Khung video không bao giờ lộ mép trống vì độ dịch bị giới hạn theo mức zoom.
// onSingleTap: chạm một lần (đã chắc không phải chạm đúp) — trình phát dùng để hiện/ẩn thanh điều khiển
export function useVideoZoom(onSingleTap?: () => void) {
  const scale = useSharedValue(MIN_ZOOM)
  const savedScale = useSharedValue(MIN_ZOOM)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const frameWidth = useSharedValue(0)
  const frameHeight = useSharedValue(0)

  // Độ dịch tối đa mỗi phía ở một mức zoom: phần video thừa ra ngoài khung chia đôi
  const getMaxOffset = (zoom: number) => {
    'worklet'
    return { x: (frameWidth.get() * (zoom - 1)) / 2, y: (frameHeight.get() * (zoom - 1)) / 2 }
  }

  // Đổi mức zoom có hiệu ứng, kéo độ dịch về trong giới hạn mới
  const zoomTo = (target: number) => {
    'worklet'
    const zoom = clamp(target, MIN_ZOOM, MAX_ZOOM)
    const maxOffset = getMaxOffset(zoom)
    scale.set(withTiming(zoom, TIMING))
    translateX.set(withTiming(clamp(translateX.get(), -maxOffset.x, maxOffset.x), TIMING))
    translateY.set(withTiming(clamp(translateY.get(), -maxOffset.y, maxOffset.y), TIMING))
  }

  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet'
      savedScale.set(scale.get())
    },
    onUpdate: event => {
      'worklet'
      const zoom = clamp(savedScale.get() * event.scale, MIN_ZOOM, MAX_ZOOM)
      const maxOffset = getMaxOffset(zoom)
      scale.set(zoom)
      translateX.set(clamp(translateX.get(), -maxOffset.x, maxOffset.x))
      translateY.set(clamp(translateY.get(), -maxOffset.y, maxOffset.y))
    },
  })

  const pan = usePanGesture({
    onBegin: () => {
      'worklet'
      savedTranslateX.set(translateX.get())
      savedTranslateY.set(translateY.get())
    },
    onUpdate: event => {
      'worklet'
      // Chưa phóng to thì giới hạn là 0 nên video đứng yên
      const maxOffset = getMaxOffset(scale.get())
      translateX.set(clamp(savedTranslateX.get() + event.translationX, -maxOffset.x, maxOffset.x))
      translateY.set(clamp(savedTranslateY.get() + event.translationY, -maxOffset.y, maxOffset.y))
    },
  })

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet'
      zoomTo(scale.get() > MIN_ZOOM ? MIN_ZOOM : DOUBLE_TAP_ZOOM)
    },
  })

  const singleTap = useTapGesture({
    enabled: Boolean(onSingleTap),
    onActivate: () => {
      'worklet'
      if (onSingleTap) scheduleOnRN(onSingleTap)
    },
  })

  // Chạm đúp được ưu tiên; chạm một lần chỉ chạy khi chắc không có lần chạm thứ hai
  const gesture = useSimultaneousGestures(pinch, pan, useExclusiveGestures(doubleTap, singleTap))

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }, { translateY: translateY.get() }, { scale: scale.get() }],
  }))

  return {
    gesture,
    animatedStyle,
    // Gắn vào khung video để biết kích thước khi giới hạn độ dịch
    onLayout: (event: LayoutChangeEvent) => {
      frameWidth.set(event.nativeEvent.layout.width)
      frameHeight.set(event.nativeEvent.layout.height)
    },
    zoomIn: () => zoomTo(scale.get() + ZOOM_STEP),
    zoomOut: () => zoomTo(scale.get() - ZOOM_STEP),
    reset: () => zoomTo(MIN_ZOOM),
  }
}

export type VideoZoom = ReturnType<typeof useVideoZoom>
