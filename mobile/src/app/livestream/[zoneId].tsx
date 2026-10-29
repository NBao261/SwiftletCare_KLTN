import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader } from '@/components/layout/AppHeader'
import { Text } from '@/components/ui/text'
import { Colors } from '@/constants/theme'

/** Livestream – VISION-FR-006 */
export default function LivestreamScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {/* Khung video nền tối: chữ thanh trạng thái màu sáng */}
      <StatusBar style="light" />
      <AppHeader
        title="Camera nhà yến"
        onBack={() => router.back()}
        backgroundColor={Colors.raw.darkCharcoal}
        foregroundColor={Colors.raw.pureWhite}
      />
      <View style={styles.video}>
        <Text color={Colors.raw.pureWhite}>Chưa có luồng video</Text>
        {/* TODO: M4
          - Đổi route sang livestream/[houseId] — camera gắn House (SRS v2.1.8)
          - RTSP/HLS video player (expo-video — SDK 58 không còn expo-av)
          - Bird count overlay
          - Detection bounding boxes overlay
        */}
      </View>
    </View>
  )
}

// Khung video luôn nền tối, không đổi theo giao diện sáng/tối
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.raw.darkCharcoal },
  video:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
