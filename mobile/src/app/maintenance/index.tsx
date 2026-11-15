import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { MaintenancePlanRow } from '@/components/maintenance/MaintenancePlanRow'
import { MaintenancePlanSheet } from '@/components/maintenance/MaintenancePlanSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useDueMaintenance } from '@/hooks/maintenance/useDueMaintenance'
import { useMaintenancePlanContext } from '@/hooks/maintenance/useMaintenancePlanContext'
import { useMaintenancePlans } from '@/hooks/maintenance/useMaintenancePlans'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { MaintenancePlan } from '@/types'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

// Hai danh sách: kế hoạch cần bảo trì (đến hạn, quá hạn) và mọi kế hoạch
type MaintenanceTab = 'due' | 'all'
const SKELETON_ROWS = 3
const ROW_SKELETON_HEIGHT = 72

/** Bảo trì phòng ngừa (OPS-FR-005…008, G-22): kế hoạch đến hạn / quá hạn kèm Work Order phòng ngừa đang mở, và mọi kế hoạch với
 * tiến độ giờ chạy hoặc hạn kế tiếp; chạm một kế hoạch để xem chu kỳ, checklist mẫu, lịch sử ghi bảo trì. Kỹ thuật viên chỉ thấy nhà
 * được giao. Chỉ đọc — làm checklist trong Work Order phòng ngừa, sửa kế hoạch trên web. Màn riêng ở stack gốc, ngoài các tab */
export default function MaintenanceScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const user = useAuthStore(state => state.user)
  const canView = canPerform(user, 'viewMaintenance')
  const [tab, setTab] = useState<MaintenanceTab>('due')
  const [openPlan, setOpenPlan] = useState<MaintenancePlan | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const dueQuery = useDueMaintenance(canView)
  const plansQuery = useMaintenancePlans(canView && tab === 'all')
  const { getHouseName, getUsage } = useMaintenancePlanContext()
  const plans = tab === 'due' ? (dueQuery.data ?? []) : (plansQuery.data?.pages.flatMap(page => page.data) ?? [])
  const activeQuery = tab === 'due' ? dueQuery : plansQuery

  if (!canView) return <Redirect href="/(tabs)/home" />

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await activeQuery.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const renderList = () => {
    if (activeQuery.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton
          key={index}
          width="100%"
          height={ROW_SKELETON_HEIGHT}
          radius={Radius.md}
          color={palette.surfaceStrong}
          delayMs={index * 75}
        />
      ))
    }
    if (activeQuery.isError) {
      return (
        <EmptyState
          message={t('Không tải được kế hoạch bảo trì')}
          actionLabel={t('Thử lại')}
          onAction={() => activeQuery.refetch()}
        />
      )
    }
    if (plans.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {tab === 'due' ? t('Không có kế hoạch nào đến hạn') : t('Chưa có kế hoạch bảo trì nào')}
        </Text>
      )
    }
    return plans.map((plan, index) => (
      <MaintenancePlanRow
        key={plan._id}
        plan={plan}
        houseName={getHouseName(plan)}
        usage={getUsage(plan)}
        hasDivider={index < plans.length - 1}
        onPress={() => setOpenPlan(plan)}
      />
    ))
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Bảo trì')} onBack={goBack} />
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
        <ChoiceChips
          options={[
            { id: 'due', label: t('Cần bảo trì') },
            { id: 'all', label: t('Tất cả kế hoạch') },
          ]}
          selectedId={tab}
          onSelect={setTab}
          accessibilityLabel={t('Lọc kế hoạch bảo trì')}
        />
        <Card>{renderList()}</Card>
        {tab === 'all' && plansQuery.hasNextPage && (
          <Button
            variant="link"
            label={t('Xem thêm')}
            onPress={() => plansQuery.fetchNextPage()}
            loading={plansQuery.isFetchingNextPage}
            style={styles.more}
          />
        )}
        <Text variant="small" color={palette.textSecondary}>
          {t(
            'Kế hoạch đến hạn thì hệ thống mở một phiếu công việc phòng ngừa cho kỹ thuật viên; làm checklist trong phiếu công việc đó. Chu kỳ do chủ trại nhập theo khuyến cáo của nhà sản xuất hoặc người nuôi.',
          )}
        </Text>
      </ScrollView>
      {openPlan && (
        <MaintenancePlanSheet
          plan={openPlan}
          houseName={getHouseName(openPlan)}
          usage={getUsage(openPlan)}
          onClose={() => setOpenPlan(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  more: { alignSelf: 'center' },
})
