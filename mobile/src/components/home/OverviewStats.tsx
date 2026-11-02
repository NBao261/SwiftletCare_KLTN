import { StyleSheet, View } from 'react-native'
import { AlertStatTile } from '@/components/home/AlertStatTile'
import { DeviceStatTile } from '@/components/home/DeviceStatTile'
import { ReturnRateBar } from '@/components/home/ReturnRateBar'
import { ZoneThresholdStatTile } from '@/components/home/ZoneThresholdStatTile'
import { Spacing } from '@/constants/theme'

// Khối 3 Trang chủ: 3 ô số liệu ngang và thanh tỷ lệ về tổ, cộng mọi Farm của người dùng
export function OverviewStats() {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <DeviceStatTile />
        <AlertStatTile />
        <ZoneThresholdStatTile />
      </View>
      <ReturnRateBar />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
})
