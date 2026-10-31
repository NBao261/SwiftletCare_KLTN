import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { HomeSection } from '@/components/home/HomeSection'
import { HOUSE_CARD_HEIGHT, HouseStatusCard } from '@/components/home/HouseStatusCard'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { useHouseStatuses } from '@/hooks/farm/useHouseStatuses'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { usePalette } from '@/hooks/theme/usePalette'

// Trang chủ hiện tối đa 5 thẻ, còn lại nằm sau "Xem tất cả (n)"
const MAX_VISIBLE_HOUSES = 5
// Thẻ rộng 85% khung để thẻ kế tiếp lộ ra một phần, gợi ý vuốt được
const CARD_WIDTH_RATIO = 0.85
const CARD_GAP = Spacing.md
const SKELETON_COUNT = 2
// Trễ thêm giữa hai thẻ xương liền nhau
const SKELETON_STEP_MS = 75
// Cập nhật thời gian "mất kết nối 14 phút", "còn 18 phút" mỗi 30 giây
const CLOCK_INTERVAL_MS = 30 * 1000

// Khoảng cách giữa hai thẻ nhà
function CardSeparator() {
  return <View style={styles.separator} />
}

// Khối "Nhà yến" ở Trang chủ: thẻ từng nhà vuốt ngang, nhà có vấn đề nặng hơn đứng trước
export function HouseCarousel() {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const { width: screenWidth } = useWindowDimensions()
  const now = useNow(CLOCK_INTERVAL_MS)
  const { items, isLoading, isError } = useHouseStatuses(now)
  const cardWidth = (screenWidth - Spacing.lg * 2) * CARD_WIDTH_RATIO
  const visibleItems = items.slice(0, MAX_VISIBLE_HOUSES)
  const hasMore = items.length > MAX_VISIBLE_HOUSES

  // shortcut: chưa có màn danh sách nhà yến — tạm mở tab Trang trại
  const openAllHouses = () => router.navigate('/(tabs)/farms')

  const renderBody = () => {
    // Đang tải: khung xương đúng hình thẻ
    if (isLoading) {
      return (
        <View style={styles.skeletonRow}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            // Thẻ nhà thật nền lime nên khung xương cũng lime; thẻ sau trễ hơn thẻ trước
            <Skeleton
              key={index}
              width={cardWidth}
              height={HOUSE_CARD_HEIGHT}
              color={palette.primary}
              delayMs={HOME_SKELETON_DELAY_MS.houses + index * SKELETON_STEP_MS}
            />
          ))}
        </View>
      )
    }
    if (isError) {
      return (
        <EmptyState
          message={t('Không tải được')}
          actionLabel={t('Thử lại')}
          onAction={() => queryClient.refetchQueries({ type: 'active' })}
          height={HOUSE_CARD_HEIGHT}
        />
      )
    }
    if (items.length === 0) {
      return (
        // Chủ trại thấy ô "Tạo nhà yến" viền nét đứt (shortcut: chưa có màn tạo nhà — tạm mở tab Trang trại)
        canPerform(user, 'createHouse') ? (
          <EmptyState
            variant="create"
            message={t('Tạo nhà yến')}
            onAction={openAllHouses}
            width={cardWidth}
            height={HOUSE_CARD_HEIGHT}
          />
        ) : (
          <EmptyState message={t('Chưa có nhà yến')} height={HOUSE_CARD_HEIGHT} />
        )
      )
    }
    return (
      <FlatList
        horizontal
        data={visibleItems}
        keyExtractor={item => item.house._id}
        renderItem={({ item }) => <HouseStatusCard data={item} width={cardWidth} />}
        ItemSeparatorComponent={CardSeparator}
        // Thả tay thì dừng gọn ở đầu thẻ
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        // Tràn sát hai mép màn (bỏ lề của Trang chủ); thẻ đầu vẫn thẳng lề nhờ padding trong danh sách
        style={styles.edgeToEdge}
        contentContainerStyle={styles.listContent}
      />
    )
  }

  return (
    <HomeSection
      title={t('Nhà yến')}
      actionLabel={hasMore ? t('Xem tất cả ({count})', { count: items.length }) : undefined}
      onAction={openAllHouses}
    >
      {renderBody()}
    </HomeSection>
  )
}

const styles = StyleSheet.create({
  separator: { width: CARD_GAP },
  edgeToEdge: { marginHorizontal: -Spacing.lg },
  listContent: { paddingHorizontal: Spacing.lg },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP, overflow: 'hidden' },
})
