import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { refetchVisibleQueries } from '@/config/queryClient'
import { ALERT_ROW_HEIGHT, AlertRow } from '@/components/alert/AlertRow'
import { HealthDayRow } from '@/components/health/HealthDayRow'
import { HomeSection } from '@/components/home/HomeSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { usePendingVerdictAlerts } from '@/hooks/alert/usePendingVerdictAlerts'
import { usePendingHealthDays } from '@/hooks/health/usePendingHealthDays'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useAuthStore } from '@/stores/authStore'
import type { Alert } from '@/types'
import { getPendingRatingRange, groupPendingDaysByHouse } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'
import { canPerform } from '@/utils/permission.utils'

// Đồng hồ cho "3 phút trước" của hàng cảnh báo
const CLOCK_INTERVAL_MS = 30 * 1000
const SKELETON_ROW_HEIGHT = 72
const SKELETON_ROW_COUNT = 3

/** Đánh giá ngày (mở từ khối cùng tên ở Trang chủ): mọi việc hiện ngay, không phải chọn nhà trước. Ngày chờ chấm chia theo nhà,
 * nhà có ngày mới nhất đứng đầu, trong nhà ngày mới nhất trước — chạm một ngày để chấm (BR-31). Chủ trại thấy thêm cảnh báo
 * chờ phán quyết ở farm chưa có chuyên gia (BR-22), xếp như tab Cảnh báo — chạm để mở chi tiết và phán quyết */
export default function PendingTasksScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const queryClient = useQueryClient()
  const now = useNow(CLOCK_INTERVAL_MS)
  const user = useAuthStore(state => state.user)
  const canDecideVerdicts = canPerform(user, 'viewOwnerTasks')
  const pendingDays = usePendingHealthDays()
  const pendingVerdicts = usePendingVerdictAlerts(canDecideVerdicts)
  const { locate } = useAlertLocations()
  const [isRefreshing, setRefreshing] = useState(false)
  const range = getPendingRatingRange(now)
  const dayGroups = groupPendingDaysByHouse(pendingDays.data, range.from, range.to)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetchVisibleQueries(queryClient)
    } finally {
      setRefreshing(false)
    }
  }

  const openAlert = (alert: Alert) =>
    router.push({
      pathname: '/alert/[alertId]',
      params: { alertId: alert._id },
    })

  const renderSkeleton = (height: number) =>
    Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <Skeleton key={index} width="100%" height={height} radius={Radius.md} delayMs={index * 75} />
    ))

  const renderDays = () => {
    if (pendingDays.isLoading) return renderSkeleton(SKELETON_ROW_HEIGHT)
    if (pendingDays.isError) {
      return <EmptyState message={t('Không tải được')} actionLabel={t('Thử lại')} onAction={handleRefresh} />
    }
    if (dayGroups.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {t('Không có ngày nào chờ bạn đánh giá')}
        </Text>
      )
    }
    // Mỗi nhà một khung: tên nhà và số ngày chờ ở đầu, các ngày mới nhất trước
    return dayGroups.map(group => (
      <Card key={group.houseId} style={styles.groupCard}>
        <Text variant="body" weight="semiBold">
          {t('{house} · {count} ngày chờ', {
            house: group.houseName,
            count: group.days.length,
          })}
        </Text>
        {group.days.map((day, index) => (
          <HealthDayRow
            key={day._id}
            day={day}
            hasDivider={index < group.days.length - 1}
            onPress={() =>
              router.push({
                pathname: '/health/[dayId]',
                params: { dayId: day._id },
              })
            }
          />
        ))}
      </Card>
    ))
  }

  const renderVerdicts = () => {
    if (pendingVerdicts.isLoading) return renderSkeleton(ALERT_ROW_HEIGHT)
    if (pendingVerdicts.isError) {
      return <EmptyState message={t('Không tải được cảnh báo')} actionLabel={t('Thử lại')} onAction={handleRefresh} />
    }
    if (pendingVerdicts.alerts.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {t('Không có cảnh báo nào chờ phán quyết')}
        </Text>
      )
    }
    const rows = pendingVerdicts.alerts.map(alert => {
      const location = locate(alert)
      return (
        <AlertRow
          key={alert._id}
          alert={alert}
          locationText={location.farmName ? `${location.farmName} › ${location.text}` : location.text}
          now={now}
          onPress={openAlert}
        />
      )
    })
    // Mỗi farm chỉ tải một trang (PENDING_VERDICT_PAGE_SIZE) nên tiêu đề (meta.total) có thể lớn hơn số dòng: nói rõ phần còn lại ở đâu
    if (pendingVerdicts.total <= pendingVerdicts.alerts.length) return rows
    return [
      ...rows,
      <Text key="more-in-alerts-tab" variant="small" color={palette.textSecondary}>
        {t('Đang hiện {shown}/{total} cảnh báo, phần còn lại xem ở tab Cảnh báo', {
          shown: pendingVerdicts.alerts.length,
          total: pendingVerdicts.total,
        })}
      </Text>,
    ]
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Đánh giá ngày')} onBack={goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        <HomeSection
          title={
            pendingDays.isLoading
              ? t('Ngày chờ đánh giá')
              : t('Ngày chờ đánh giá ({count})', {
                  count: pendingDays.data.length,
                })
          }
        >
          <View style={styles.list}>{renderDays()}</View>
        </HomeSection>
        {canDecideVerdicts && (
          <HomeSection
            title={
              pendingVerdicts.isLoading
                ? t('Cảnh báo chờ phán quyết')
                : t('Cảnh báo chờ phán quyết ({count})', {
                    count: pendingVerdicts.total,
                  })
            }
          >
            <View style={styles.list}>{renderVerdicts()}</View>
          </HomeSection>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  list: { gap: Spacing.sm },
  groupCard: { gap: Spacing.xs },
})
