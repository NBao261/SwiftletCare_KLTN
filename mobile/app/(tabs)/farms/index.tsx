import { View, Text, StyleSheet, FlatList } from 'react-native'

/** Farm List – FARM-FR-001 */
export default function FarmsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trang trại của bạn</Text>
      {/* TODO: M4
        - FlatList of farm cards
        - FAB button to create new farm
        - Pull-to-refresh
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
})
