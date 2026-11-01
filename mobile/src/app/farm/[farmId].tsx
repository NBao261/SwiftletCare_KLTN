import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const SKELETON_HEIGHT = 164

/** Chuyển tiếp: farm giờ mở ở tab Trang trại (Màn A) — giữ route cho link cũ */
export default function FarmRedirectScreen() {
  const palette = usePalette()
  const { farmId } = useLocalSearchParams<{ farmId: string }>()

  // dismissTo bỏ màn này khỏi stack gốc rồi về tab, không tạo thêm một bộ tab
  useEffect(() => {
    router.dismissTo({ pathname: '/(tabs)/farms', params: { farmId } })
  }, [farmId])

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Skeleton width="100%" height={SKELETON_HEIGHT} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.lg },
})
