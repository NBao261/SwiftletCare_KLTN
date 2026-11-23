import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { CaretRightIcon, HeartbeatIcon } from 'phosphor-react-native'
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge'
import { Button } from '@/components/ui/button'
import { RetryLine } from '@/components/common/RetryLine'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useHealthDays } from '@/hooks/health/useHealthDays'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { getVietnamDate } from '@/utils/date.utils'
import { formatHealthDate, getMyRatingCaption, shiftDate } from '@/utils/healthDay.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const CARD_SKELETON_HEIGHT = 88

interface HealthDayCardProps {
  houseId: string
}

// Trạng thái ngày gần nhất của nhà ở màn nhà (MF-06): luôn hiện trạng thái (BR-31); ngày còn chờ chấm thì thêm nút đánh giá
export function HealthDayCard({ houseId }: HealthDayCardProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const today = getVietnamDate()
  // Ngày được đánh giá sau phiên chiều (19:15), nên trước giờ đó ngày gần nhất là hôm qua
  const daysQuery = useHealthDays(houseId, shiftDate(today, -1), today)
  const latest = daysQuery.data?.[0] ?? null
  const openList = () => router.push({ pathname: '/health', params: { houseId } })

  if (daysQuery.isLoading) return <Skeleton width="100%" height={CARD_SKELETON_HEIGHT} radius={Radius.lg} />

  const renderBody = () => {
    if (daysQuery.isError) {
      return (
        <RetryLine message={t('Không tải được trạng thái ngày')} onRetry={() => daysQuery.refetch()} isRetrying={daysQuery.isFetching} />
      )
    }
    if (!latest) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {t('Chưa có trạng thái ngày')}
        </Text>
      )
    }
    const caption = getMyRatingCaption(latest)
    const canRate = latest.my_rating_state === 'PENDING' && canPerform(user, 'rateHealthDay')
    return (
      <>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="body" weight="semiBold">
              {formatHealthDate(latest.date)}
            </Text>
            {caption && (
              <Text variant="small" color={palette.textSecondary}>
                {caption}
              </Text>
            )}
          </View>
          <HealthStatusBadge status={latest.current_status} />
        </View>
        {canRate && (
          <Button
            label={t('Đánh giá ngày')}
            size="sm"
            onPress={() => router.push({ pathname: '/health/[dayId]', params: { dayId: latest._id } })}
          />
        )}
      </>
    )
  }

  return (
    <Card onPress={openList} accessibilityLabel={t('Trạng thái ngày')} accessibilityHint={t('Mở các ngày của nhà')}>
      <View style={styles.row}>
        <HeartbeatIcon size={20} color={palette.text} />
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {t('Trạng thái ngày')}
        </Text>
        <CaretRightIcon size={16} color={palette.textSecondary} />
      </View>
      {renderBody()}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
})
