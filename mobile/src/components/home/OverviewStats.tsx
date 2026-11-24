import { StyleSheet, View } from 'react-native'
import { AlertStatTile } from '@/components/home/AlertStatTile'
import { DeviceStatTile } from '@/components/home/DeviceStatTile'
import { HomeSection } from '@/components/home/HomeSection'
import { ReturnRateBar } from '@/components/home/ReturnRateBar'
import { ZoneThresholdStatTile } from '@/components/home/ZoneThresholdStatTile'
import { Spacing } from '@/constants/theme'
import { t } from '@/utils/i18n.utils'

// Khối 3 Trang chủ: 3 ô số liệu ngang và thanh tỷ lệ về tổ, cộng mọi Farm của người dùng
export function OverviewStats() {
  return (
    <HomeSection title={t('Tổng quan nhà yến')}>
      <View style={styles.content}>
        <View style={styles.row}>
          <DeviceStatTile />
          <AlertStatTile />
          <ZoneThresholdStatTile />
        </View>
        <ReturnRateBar />
      </View>
    </HomeSection>
  )
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
})
