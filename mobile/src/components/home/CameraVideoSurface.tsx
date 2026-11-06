import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { VideoView, type VideoPlayer } from 'expo-video'
import { VideoCameraIcon } from 'phosphor-react-native'
import { ZoomableView } from '@/components/common/ZoomableView'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { VideoZoom } from '@/hooks/device/useVideoZoom'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

interface CameraVideoSurfaceProps {
  player: VideoPlayer
  // Có thì không phát video mà hiện câu này (mất kết nối, không mở được luồng)
  message: string | null
  isLoading: boolean
  onRetry?: () => void
  // Khung nhỏ của mini-player: chỉ icon, không chữ
  isCompact?: boolean
  // Có thì khung nhận cử chỉ zoom và chạm để hiện/ẩn thanh điều khiển, kể cả khi chỉ có câu báo (khung camera ở tab Trang trại)
  zoom?: VideoZoom
}

// Phần video của trình phát: luồng video, vòng chờ khi đang mở, hoặc thông báo khi không phát được.
// Video không nhận chạm để chạm vào khung đi tới lớp điều khiển bên ngoài
export function CameraVideoSurface({ player, message, isLoading, onRetry, isCompact = false, zoom }: CameraVideoSurfaceProps) {
  const palette = usePalette()

  if (message) {
    const content = (
      <View style={styles.center} accessibilityLabel={message}>
        <VideoCameraIcon size={isCompact ? 20 : 24} color={palette.onInverseSecondary} />
        {!isCompact && (
          <Text variant="small" color={palette.onInverse} center>
            {message}
          </Text>
        )}
        {!isCompact && onRetry && <Button variant="link" label={t('Thử lại')} color={palette.onInverse} onPress={onRetry} />}
      </View>
    )
    return zoom ? <ZoomableView zoom={zoom}>{content}</ZoomableView> : content
  }

  return (
    <>
      {zoom ? (
        <ZoomableView zoom={zoom}>
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} pointerEvents="none" />
        </ZoomableView>
      ) : (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} pointerEvents="none" />
      )}
      {isLoading && (
        <View style={styles.center} pointerEvents="none" accessibilityLabel={t('Đang mở luồng video')}>
          <ActivityIndicator color={palette.onInverse} />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
})
