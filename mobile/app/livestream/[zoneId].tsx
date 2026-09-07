import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

/** Livestream – VISION-FR-006 */
export default function LivestreamScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Zone {zoneId}</Text>
      {/* TODO: M4
        - RTSP/HLS video player (expo-av)
        - Bird count overlay
        - Detection bounding boxes overlay
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 18, color: '#FFF' },
})
