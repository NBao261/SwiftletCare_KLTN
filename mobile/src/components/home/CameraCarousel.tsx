import { FlatList, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { CAMERA_CARD_WIDTH, CameraCard } from '@/components/home/CameraCard'
import { HomeSection } from '@/components/home/HomeSection'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Spacing } from '@/constants/theme'
import { useCameraCards, type CameraCardData } from '@/hooks/device/useCameraCards'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'

const CARD_GAP = Spacing.md
// Chiều cao khung giữ chỗ khi đang tải/lỗi: khung 16:9 + phần chữ bên dưới
const PLACEHOLDER_HEIGHT = (CAMERA_CARD_WIDTH * 9) / 16 + 64
const SKELETON_COUNT = 2
// Trễ thêm giữa hai thẻ xương liền nhau
const SKELETON_STEP_MS = 75

// Khoảng cách giữa hai thẻ camera
function CardSeparator() {
  return <View style={styles.separator} />
}

interface CameraCarouselProps {
  onOpen: (data: CameraCardData) => void
}

// Khối "Camera AI" ở Trang chủ: thẻ từng camera vuốt ngang, bấm thì mở trình phát tại chỗ; không có camera vẫn giữ khung
export function CameraCarousel({ onOpen }: CameraCarouselProps) {
  const queryClient = useQueryClient()
  const { cards, isLoading, isError } = useCameraCards()

  const user = useAuthStore(state => state.user)
  const canRegisterCamera = canPerform(user, 'registerCamera')

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.skeletonRow}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            // Thẻ camera là card trắng: khung xương trắng mặc định; thẻ sau trễ hơn thẻ trước
            <Skeleton
              key={index}
              width={CAMERA_CARD_WIDTH}
              height={PLACEHOLDER_HEIGHT}
              delayMs={HOME_SKELETON_DELAY_MS.cameras + index * SKELETON_STEP_MS}
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
          width={CAMERA_CARD_WIDTH}
          height={PLACEHOLDER_HEIGHT}
        />
      )
    }
    if (cards.length === 0) {
      // Chủ trại thấy ô "Tạo camera AI" viền nét đứt; chuyên gia không đăng ký camera nên chỉ thấy khung trống
      // (shortcut: chưa có màn đăng ký camera cho nhà, FARM-FR-004 — tạm mở tab Trang trại)
      return canRegisterCamera ? (
        <EmptyState
          variant="create"
          message={t('Tạo camera AI')}
          onAction={() => router.navigate('/(tabs)/farms')}
          width={CAMERA_CARD_WIDTH}
          height={PLACEHOLDER_HEIGHT}
        />
      ) : (
        <EmptyState message={t('Chưa có camera AI')} width={CAMERA_CARD_WIDTH} height={PLACEHOLDER_HEIGHT} />
      )
    }
    return (
      <FlatList
        horizontal
        data={cards}
        keyExtractor={card => card.camera._id}
        renderItem={({ item }) => <CameraCard data={item} onOpen={onOpen} />}
        ItemSeparatorComponent={CardSeparator}
        // Thẻ rộng cố định 280 nên thẻ kế lộ ra một phần; thả tay thì dừng gọn ở đầu thẻ
        snapToInterval={CAMERA_CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        // Tràn sát hai mép màn (bỏ lề của Trang chủ); thẻ đầu vẫn thẳng lề nhờ padding trong danh sách
        style={styles.edgeToEdge}
        contentContainerStyle={styles.listContent}
      />
    )
  }

  return <HomeSection title={t('Camera AI')}>{renderBody()}</HomeSection>
}

const styles = StyleSheet.create({
  separator: { width: CARD_GAP },
  edgeToEdge: { marginHorizontal: -Spacing.lg },
  listContent: { paddingHorizontal: Spacing.lg },
  skeletonRow: { flexDirection: 'row', gap: CARD_GAP, overflow: 'hidden' },
})
