import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

// Như trình phát Trang chủ: điều khiển tự ẩn sau 3 giây không chạm, mờ dần
const HIDE_DELAY_MS = 3000
const FADE = { duration: 200, reduceMotion: ReduceMotion.System }

// Thanh điều khiển trên video kiểu YouTube: chạm khung để hiện/ẩn; chỉ tự ẩn sau 3 giây khi canAutoHide (đang phát).
// Bật trình đọc màn hình thì luôn hiện để chạm được nút
export function useAutoHideControls(canAutoHide: boolean) {
  const [isVisible, setVisible] = useState(true)
  // Mỗi lần người dùng chạm nút thì đếm lại 3 giây
  const [touchCount, setTouchCount] = useState(0)
  const [isScreenReaderOn, setScreenReaderOn] = useState(false)
  const opacity = useSharedValue(1)
  const isShown = isVisible || isScreenReaderOn

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderOn).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderOn)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    opacity.set(withTiming(isShown ? 1 : 0, FADE))
    if (!isShown || !canAutoHide || isScreenReaderOn) return
    const timer = setTimeout(() => setVisible(false), HIDE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isShown, canAutoHide, isScreenReaderOn, touchCount, opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return {
    isVisible: isShown,
    animatedStyle,
    // Chạm vào video
    toggle: () => setVisible(visible => !visible),
    // Bấm một nút trên thanh: giữ thanh hiện thêm 3 giây
    keepVisible: () => {
      setVisible(true)
      setTouchCount(count => count + 1)
    },
  }
}
