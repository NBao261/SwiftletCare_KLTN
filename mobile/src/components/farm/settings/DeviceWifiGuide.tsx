import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const STEP_NUMBER_SIZE = 24

interface DeviceWifiGuideProps {
  deviceId: string
}

// Cài Wi-Fi cho bộ điều khiển qua chế độ phát Wi-Fi riêng (FARM-FR-003b): theo đúng firmware — chưa có Wi-Fi thì thiết bị phát
// mạng "SwiftletCare-Setup-<mã thiết bị>" không mật khẩu, trang cài đặt ở 192.168.4.1 (firmware/src/wifi/WiFiProvisioner.cpp).
// Trang đó chỉ hỏi tên và mật khẩu Wi-Fi của trang trại (FARM-FR-003c)
export function DeviceWifiGuide({ deviceId }: DeviceWifiGuideProps) {
  const palette = usePalette()
  const steps = [
    // Firmware thử Wi-Fi đã lưu 20 lần × 0,5 giây, không được mới phát mạng cài đặt (WiFiProvisioner::tryConnect)
    t('Cắm điện bộ điều khiển. Chưa có Wi-Fi thì khoảng 10 giây sau nó tự phát mạng cài đặt.'),
    t('Mở Wi-Fi trên điện thoại, chọn mạng {network} (không có mật khẩu).', { network: `SwiftletCare-Setup-${deviceId}` }),
    t('Trang cài đặt tự mở. Nếu không thấy, mở trình duyệt và vào 192.168.4.1.'),
    t('Chọn Wi-Fi của trang trại, nhập mật khẩu rồi bấm Lưu. Bộ điều khiển tự khởi động lại và kết nối.'),
    t('Cho điện thoại về Wi-Fi hoặc 4G thường rồi quay lại đây xem tiến trình.'),
  ]

  return (
    <View style={styles.guide}>
      <Text variant="body" weight="semiBold">
        {t('Cài Wi-Fi cho bộ điều khiển')}
      </Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={[styles.number, { backgroundColor: palette.surfaceStrong }]}>
            <Text variant="small" weight="semiBold">
              {String(index + 1)}
            </Text>
          </View>
          <Text variant="small" style={styles.stepText}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  guide: { gap: Spacing.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  number: {
    width: STEP_NUMBER_SIZE,
    height: STEP_NUMBER_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, minWidth: 0, paddingTop: Spacing.xs / 2 },
})
