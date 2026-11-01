import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import type { VideoZoom } from '@/hooks/device/useVideoZoom'

interface ZoomableViewProps {
  zoom: VideoZoom
  // Nội dung phủ kín khung: video, hoặc câu báo khi chưa có video
  children?: ReactNode
}

// Khung nhận cử chỉ của trình phát: chụm / kéo / chạm đúp để zoom, chạm một lần để hiện/ẩn thanh điều khiển.
// Khung cha phải cắt phần thừa (overflow hidden)
export function ZoomableView({ zoom, children }: ZoomableViewProps) {
  return (
    <GestureDetector gesture={zoom.gesture}>
      <Animated.View style={[StyleSheet.absoluteFill, zoom.animatedStyle]} onLayout={zoom.onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  )
}
