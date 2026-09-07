import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

/** Farm Detail – FARM-FR-002, FARM-FR-003 */
export default function FarmDetailScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>()

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Trang trại {farmId}</Text>
      {/* TODO: M4
        - Farm info header + map (react-native-maps)
        - House list → Zone list
        - Device status per zone
        - Member management
      */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title:     { fontSize: 20, fontWeight: '600' },
})
