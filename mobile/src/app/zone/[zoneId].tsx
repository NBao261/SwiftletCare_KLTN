import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'

const SKELETON_HEIGHT = 164

/** Chuyển tiếp: zone giờ là tab tầng trong Màn B của nhà chứa nó — giữ route cho link cũ */
export default function ZoneRedirectScreen() {
  const palette = usePalette()
  const { zoneId } = useLocalSearchParams<{ zoneId: string }>()
  const { zoneById, isLoading } = useZoneDirectory()
  const houseId = zoneById.get(zoneId)?.house_id

  // Tìm được nhà thì mở Màn B đúng tầng; tải xong mà không thấy zone thì về danh sách nhà
  useEffect(() => {
    if (houseId) router.dismissTo({ pathname: '/(tabs)/farms/[houseId]', params: { houseId, zoneId } })
    else if (!isLoading) router.dismissTo('/(tabs)/farms')
  }, [houseId, zoneId, isLoading])

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Skeleton width="100%" height={SKELETON_HEIGHT} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.lg },
})
