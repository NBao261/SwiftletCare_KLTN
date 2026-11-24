import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useOpenRecommendationCount } from '@/hooks/recommendation/useOpenRecommendationCount'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const COUNT_BOX_SIZE = 48
// Chiều cao khung xương / khung lỗi: ô số 48 + lề card 16×2
const CARD_HEIGHT = COUNT_BOX_SIZE + Spacing.lg * 2

// Khối "Khuyến nghị" ở Trang chủ của chủ trại (MF-08, EXPERT-FR-018): số khuyến nghị đang chờ quyết định ở mọi farm; chạm để mở
// danh sách ở farm đầu tiên còn khuyến nghị mở (màn danh sách xem theo một farm, đổi farm ở tiêu đề). Backend không gửi thông
// báo khi có khuyến nghị mới nên khối này là lối vào chính. Hết việc vẫn giữ khối, số là 0
export function RecommendationTasksCard() {
  const palette = usePalette()
  // Chỉ đọc meta.total mỗi farm, không tải danh sách
  const openQuery = useOpenRecommendationCount()

  if (openQuery.isLoading) return <Skeleton width="100%" height={CARD_HEIGHT} />
  if (openQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được khuyến nghị')}
        actionLabel={t('Thử lại')}
        onAction={() => openQuery.refetch()}
        height={CARD_HEIGHT}
      />
    )
  }

  const count = openQuery.count
  const summary =
    count === 0 ? t('Không có khuyến nghị nào chờ quyết định') : t('{n} khuyến nghị chờ bạn chấp nhận hoặc từ chối', { n: count })

  return (
    <Card
      style={styles.card}
      onPress={() =>
        router.push(
          openQuery.firstOpenFarmId
            ? { pathname: '/recommendations', params: { farmId: openQuery.firstOpenFarmId } }
            : '/recommendations',
        )
      }
      accessibilityLabel={`${t('Khuyến nghị')}: ${summary}`}
      accessibilityHint={t('Mở danh sách khuyến nghị')}
    >
      {/* Lime chỉ làm chữ trên nền Ink */}
      <View style={[styles.countBox, { backgroundColor: palette.inverse }]}>
        <Text variant="heading" weight="bold" color={palette.primary}>
          {count}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold">
          {t('Khuyến nghị')}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  countBox: {
    width: COUNT_BOX_SIZE,
    height: COUNT_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
