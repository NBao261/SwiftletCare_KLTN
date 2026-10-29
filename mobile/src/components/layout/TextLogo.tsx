import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'

// Kích thước ảnh gốc (đã cắt sát chữ) — dùng để giữ đúng tỉ lệ khi đổi chiều rộng
const SOURCE_WIDTH = 1427
const SOURCE_HEIGHT = 218

const DEFAULT_WIDTH = 200

const LOGO_IMAGE = require('@/assets/images/mobile-scare-text.png')

interface TextLogoProps {
  // Chiều rộng hiển thị; chiều cao tự tính theo tỉ lệ ảnh gốc
  width?: number
}

// Logo chữ SwiftletCare — dùng ở splash và màn đăng nhập
export function TextLogo({ width = DEFAULT_WIDTH }: TextLogoProps) {
  const height = Math.round((width * SOURCE_HEIGHT) / SOURCE_WIDTH)

  return (
    <Image
      source={LOGO_IMAGE}
      style={[styles.logo, { width, height }]}
      contentFit="contain"
      accessibilityLabel="SwiftletCare"
    />
  )
}

const styles = StyleSheet.create({
  logo: { alignSelf: 'center' },
})
