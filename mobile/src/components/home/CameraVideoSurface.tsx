import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { VideoView, type VideoPlayer } from 'expo-video'
import { VideoCameraIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
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
}

// Phần video của trình phát: luồng video, vòng chờ khi đang mở, hoặc thông báo khi không phát được.
// Video không nhận chạm để chạm vào khung đi tới lớp điều khiển bên ngoài
export function CameraVideoSurface({ player, message, isLoading, onRetry, isCompact = false }: CameraVideoSurfaceProps) {
  const palette = usePalette()

  if (message) {
    return (
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
  }

  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} pointerEvents="none" />
      {isLoading && (
        <View style={styles.center} accessibilityLabel={t('Đang mở luồng video')}>
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
