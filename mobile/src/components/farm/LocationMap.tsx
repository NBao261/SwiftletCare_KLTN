import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { RetryLine } from '@/components/common/RetryLine'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Coordinates } from '@/types'
import { t } from '@/utils/i18n.utils'
import {
  buildLocationMapHtml,
  buildSetPinScript,
  isSameCoordinates,
  parseLocationMapMessage,
} from '@/utils/locationMap.utils'

interface LocationMapProps {
  // Vị trí đang chọn; null thì chưa có ghim (khung nhìn cả Việt Nam)
  coordinates: Coordinates | null
  // Có thì bản đồ kéo, phóng được và báo vị trí dưới ghim mỗi khi người dùng dừng kéo; không có là ảnh xem trước, không nhận chạm
  onPick?: (coordinates: Coordinates) => void
  // Không truyền thì bản đồ cao hết chỗ của khung cha (màn ghim toàn màn hình)
  height?: number
}

// Bản đồ OpenStreetMap (Leaflet trong WebView, như web — Report 4 §3.1): ghim map-pin đứng yên ở giữa khung, người dùng kéo bản đồ
// để đưa đúng chỗ xuống dưới ghim, vị trí chọn là tâm bản đồ. Toạ độ đổi từ ngoài (GPS, gõ tay) thì bản đồ di chuyển tới đó; toạ
// độ do chính người dùng kéo ra thì không đẩy lại vào bản đồ. Mất mạng không tải được bản đồ thì báo và cho tải lại
export function LocationMap({ coordinates, onPick, height }: LocationMapProps) {
  const palette = usePalette()
  // Tham số kiểu object: khai báo của react-native-webview mặc định là undefined, làm props thành never trong TypeScript
  const webViewRef = useRef<WebView<object>>(null)
  const isInteractive = Boolean(onPick)
  // Trang HTML dựng một lần với vị trí lúc mở; về sau chỉ gửi lệnh đặt ghim, không tải lại bản đồ
  const [html] = useState(() =>
    buildLocationMapHtml({
      coordinates,
      isInteractive,
      // Ghim lime đặc không viền; bóng mờ Ink 35% (token videoDim) giúp ghim nổi trên nền bản đồ sáng
      pinColor: palette.primary,
      pinShadowColor: palette.videoDim,
    }),
  )
  // Vị trí người dùng vừa ghim trên bản đồ: cùng vị trí thì không kéo khung nhìn
  const lastPicked = useRef<Coordinates | null>(coordinates)
  const [hasLoadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!coordinates || isSameCoordinates(coordinates, lastPicked.current)) return
    lastPicked.current = coordinates
    webViewRef.current?.injectJavaScript(buildSetPinScript(coordinates))
  }, [coordinates])

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseLocationMapMessage(event.nativeEvent.data)
    if (!message) return
    if (message.kind === 'load-error') {
      setLoadError(true)
      return
    }
    lastPicked.current = message.coordinates
    onPick?.(message.coordinates)
  }

  const reload = () => {
    setLoadError(false)
    webViewRef.current?.reload()
  }

  return (
    <View style={[height ? [styles.card, { height }] : styles.fill, { backgroundColor: palette.surfaceStrong }]}>
      <WebView<object>
        ref={webViewRef}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onError={() => setLoadError(true)}
        javaScriptEnabled
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // Xem trước thì không nhận chạm: trang cuộn được khi vuốt qua bản đồ
        pointerEvents={isInteractive ? 'auto' : 'none'}
        style={styles.webView}
        accessibilityLabel={isInteractive ? t('Bản đồ: kéo bản đồ để ghim ở giữa nằm đúng trang trại') : t('Bản đồ vị trí')}
      />
      {hasLoadError && (
        <View style={[styles.error, { backgroundColor: palette.surfaceStrong }]}>
          <RetryLine message={t('Không tải được bản đồ. Kiểm tra mạng')} onRetry={reload} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Bản đồ trong card bo góc; bản đồ toàn màn hình thì không bo
  card: { borderRadius: Radius.md, overflow: 'hidden' },
  fill: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: 'transparent' },
  error: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
})
