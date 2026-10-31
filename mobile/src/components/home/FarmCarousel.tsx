import { useState } from 'react'
import {
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { router } from 'expo-router'
import { FarmBannerCard } from '@/components/home/FarmBannerCard'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useFarms } from '@/hooks/farm/useFarms'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'

const CARD_GAP = Spacing.md
const PLACEHOLDER_HEIGHT = 168
const DOT_SIZE = 6
const ACTIVE_DOT_WIDTH = 18

// Khoảng cách giữa hai khung Farm
function CardSeparator() {
  return <View style={styles.separator} />
}

// Khối 2 Trang chủ: mỗi khung là tổng quan của một Farm, vuốt ngang để chuyển Farm
export function FarmCarousel() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const { width: screenWidth } = useWindowDimensions()
  const { data, isLoading, isError, refetch } = useFarms()
  const [activeIndex, setActiveIndex] = useState(0)
  // Backend trả Farm mới nhất trước; Trang chủ hiện Farm tạo trước ở đầu (chuỗi ISO so sánh được theo thứ tự thời gian)
  const farms = [...(data?.data ?? [])].sort((first, second) => first.created_at.localeCompare(second.created_at))
  // Khung rộng bằng màn trừ lề hai bên của ScrollView Trang chủ
  const cardWidth = screenWidth - Spacing.lg * 2

  // Vuốt xong thì tính khung đang hiện để tô chấm trang
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP)))
  }

  // Khung Farm thật nền Ink nên khung xương cũng Ink
  if (isLoading) {
    return <Skeleton width="100%" height={PLACEHOLDER_HEIGHT} color={palette.inverse} delayMs={HOME_SKELETON_DELAY_MS.farms} />
  }
  if (isError) {
    return (
      <EmptyState
        message={t('Không tải được danh sách trang trại')}
        actionLabel={t('Thử lại')}
        onAction={() => refetch()}
        height={PLACEHOLDER_HEIGHT}
      />
    )
  }
  if (farms.length === 0) {
    // Chủ trại thấy ô "Tạo trang trại" viền nét đứt; chuyên gia chỉ thấy câu báo
    return canPerform(user, 'createFarm') ? (
      // shortcut: chưa có màn tạo trang trại — tạm mở tab Trang trại
      <EmptyState
        variant="create"
        message={t('Tạo trang trại')}
        onAction={() => router.navigate('/(tabs)/farms')}
        height={PLACEHOLDER_HEIGHT}
      />
    ) : (
      <EmptyState message={t('Chưa có trang trại')} height={PLACEHOLDER_HEIGHT} />
    )
  }

  return (
    <View style={styles.carousel}>
      <FlatList
        horizontal
        data={farms}
        keyExtractor={farm => farm._id}
        renderItem={({ item: farm }) => <FarmBannerCard farm={farm} width={cardWidth} />}
        ItemSeparatorComponent={CardSeparator}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
      />
      {farms.length > 1 && (
        // Chấm trang chỉ để trang trí — trình đọc màn hình đã đọc tên từng Farm
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {farms.map((farm, index) => (
            <View
              key={farm._id}
              style={[
                styles.dot,
                index === activeIndex
                  ? { width: ACTIVE_DOT_WIDTH, backgroundColor: palette.text }
                  : { backgroundColor: palette.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  carousel: { gap: Spacing.md },
  separator: { width: CARD_GAP },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
