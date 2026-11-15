import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native'
import { PressableScale } from '@/components/ui/pressable-scale'
import { useLocalSearchParams } from 'expo-router'
import { ArrowUp, SlidersHorizontal } from 'phosphor-react-native'
import { ExpertHeaderPicker, PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { VerdictCard } from '@/components/expert/VerdictCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useVerdictsScreen, type VerdictFilter } from '@/hooks/expert/useVerdictsScreen'
import { t } from '@/utils/i18n.utils'

const KPI_TILE_HEIGHT = 112

// Chỉ 4 loại cảnh báo suy luận cần kiểm chứng — MISTING_INEFFECTIVE là device alert, không thuộc inferred types (api-spec.yaml dòng 3105)
const INFERRED_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả loại sự cố' },
  { key: 'NOISE_ANOMALY', label: 'Tiếng ồn bất thường trong nhà' },
  { key: 'SENSOR_ANOMALY', label: 'Cảm biến nhảy số bất thường' },
  { key: 'LOW_RETURN_RATE', label: 'Đàn chim về tổ sụt giảm' },
  { key: 'FORECAST_BREACH', label: 'Dự báo sắp lệch nhiệt ẩm' },
]

const SEVERITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả mức độ' },
  { key: 'CRITICAL', label: 'Khẩn cấp' },
  { key: 'HIGH', label: 'Cao' },
  { key: 'MEDIUM', label: 'Trung bình' },
  { key: 'LOW', label: 'Thường' },
]

const STATUS_CHIPS: { key: VerdictFilter; label: string }[] = [
  { key: 'PENDING', label: 'Chờ kiểm tra' },
  { key: 'CONFIRMED', label: 'Báo đúng' },
  { key: 'REJECTED', label: 'Báo ảo' },
]

/**
 * [PHẦN 2] MOBILE — MENU THẨM ĐỊNH (src/app/(tabs)/verdicts/index.tsx)
 * Màn mỏng: dữ liệu/KPI/phân trang/ghi phán quyết nằm trong useVerdictsScreen; màn chỉ render.
 * Calm Industrial đồng bộ với nhánh FARM_OWNER.
 */
export default function VerdictsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const params = useLocalSearchParams<{ alertId?: string }>()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const cardLayouts = useRef<Record<string, number>>({})
  const listSectionY = useRef(0)

  const {
    kpi,
    alerts,
    statusFilter,
    setStatusFilter,
    selectedType,
    setSelectedType,
    selectedSeverity,
    setSelectedSeverity,
    hasAdvancedFilter,
    isLoading,
    isError,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetchAll,
    submitVerdict,
    isSubmitting,
    toastMessage,
  } = useVerdictsScreen()

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [userToggledAlertId, setUserToggledAlertId] = useState<string | null | undefined>(undefined)
  const expandedAlertId = userToggledAlertId !== undefined ? userToggledAlertId : (params.alertId ?? null)

  useEffect(() => {
    if (params.alertId) {
      const timer = setTimeout(() => {
        const targetY = cardLayouts.current[params.alertId!]
        if (targetY != null) {
          scrollRef.current?.scrollTo({ y: Math.max(0, targetY - 60), animated: true })
        }
      }, 200)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [params.alertId])

  const handleToggleCard = useCallback(
    (alertId: string) => {
      setUserToggledAlertId(prev => {
        const current = prev !== undefined ? prev : (params.alertId ?? null)
        return current === alertId ? null : alertId
      })
    },
    [params.alertId]
  )

  const handleKpiPress = useCallback(
    (status: VerdictFilter) => {
      setStatusFilter(status)
      scrollRef.current?.scrollTo({ y: Math.max(0, listSectionY.current - 12), animated: true })
    },
    [setStatusFilter]
  )

  const pendingTileWarning = kpi.pending > 0
  const pendingSecondaryColor = pendingTileWarning ? palette.severityP2Text : palette.textSecondary

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader leading={<ExpertHeaderPicker />} />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} tintColor={palette.text} />
        }
      >
        {/* KHỐI 1: Thanh chọn Tầng ghim cố định đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Ô KPI — số liệu từ verdict-stats (toàn bộ, mọi trang) */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('PENDING')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Tổng cảnh báo suy luận')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Tổng cảnh báo')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} sự cố', { count: kpi.total })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Đã ghi nhận')}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('PENDING')}
                style={[styles.kpiTile, { backgroundColor: pendingTileWarning ? palette.severityP2 : palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Lọc cảnh báo chờ kiểm tra')}
              >
                <Text variant="small" color={pendingSecondaryColor} numberOfLines={1}>
                  {t('Chờ kiểm tra')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đang mở', { count: kpi.pending })}
                </Text>
                <Text variant="small" color={pendingSecondaryColor} numberOfLines={1}>
                  {kpi.pending > 0 ? t('Cần chuyên gia xem') : t('Đã xử lý hết')}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('CONFIRMED')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Lọc cảnh báo báo đúng')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo đúng')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {`${kpi.confirmRate}%`}
                </Text>
                <View style={styles.kpiCaptionRow}>
                  <ArrowUp size={12} color={palette.houseHealthy} weight="bold" />
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {t('Tỷ lệ chuẩn xác')}
                  </Text>
                </View>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('REJECTED')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Lọc cảnh báo báo ảo')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo ảo (Bác bỏ)')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đã loại', { count: kpi.rejected })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo sai / nhiễu')}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* KHỐI 3: Chip trạng thái kiểm chứng (lọc ở server) + nút Bộ lọc nâng cao */}
          <View
            onLayout={e => {
              listSectionY.current = e.nativeEvent.layout.y
            }}
            style={styles.filterSection}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
              {STATUS_CHIPS.map(chip => {
                const active = statusFilter === chip.key
                const count = chip.key === 'PENDING' ? kpi.pending : chip.key === 'CONFIRMED' ? kpi.confirmed : kpi.rejected
                return (
                  <Pressable
                    key={chip.key}
                    hitSlop={8}
                    onPress={() => setStatusFilter(chip.key)}
                    style={[styles.filterChip, { backgroundColor: active ? palette.inverse : palette.surface }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text variant="body" weight="semiBold" color={active ? palette.onInverse : palette.text}>
                      {t('{label} ({count})', { label: t(chip.label), count })}
                    </Text>
                  </Pressable>
                )
              })}

              <Pressable
                hitSlop={8}
                onPress={() => setIsFilterSheetOpen(true)}
                style={[styles.filterChip, styles.advancedFilterButton, { backgroundColor: hasAdvancedFilter ? palette.inverse : palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Bộ lọc nâng cao')}
              >
                <SlidersHorizontal size={14} weight="bold" color={hasAdvancedFilter ? palette.onInverse : palette.text} />
                <Text variant="body" weight="semiBold" color={hasAdvancedFilter ? palette.onInverse : palette.text}>
                  {t('Bộ lọc')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* KHỐI 4: Danh sách Card Cảnh báo + tải thêm theo trang (meta) */}
          <View style={styles.alertListSection}>
            {isError ? (
              <EmptyState
                message={t('Không tải được danh sách cảnh báo. Vui lòng kéo xuống để thử lại.')}
                actionLabel={t('Thử lại')}
                onAction={refetchAll}
              />
            ) : isLoading ? (
              <View style={styles.skeletonWrapper}>
                <Skeleton width="100%" height={120} radius={Radius.lg} />
                <View style={{ height: Spacing.md }} />
                <Skeleton width="100%" height={120} radius={Radius.lg} />
                <View style={{ height: Spacing.md }} />
                <Skeleton width="100%" height={120} radius={Radius.lg} />
              </View>
            ) : alerts.length === 0 ? (
              <EmptyState message={t('Không tìm thấy sự cố nào thỏa mãn bộ lọc hiện tại.')} />
            ) : (
              <>
                {alerts.map(alert => (
                  <View
                    key={alert._id}
                    onLayout={e => {
                      cardLayouts.current[alert._id] = e.nativeEvent.layout.y
                    }}
                  >
                    <VerdictCard
                      alert={alert}
                      isExpanded={expandedAlertId === alert._id}
                      onToggleExpand={() => handleToggleCard(alert._id)}
                      onVerdictSubmit={submitVerdict}
                      isSubmitting={isSubmitting}
                    />
                  </View>
                ))}
                {hasNextPage && (
                  <Button
                    label={t('Xem thêm')}
                    variant="link"
                    loading={isFetchingNextPage}
                    onPress={() => fetchNextPage()}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* BottomSheet: Bộ lọc phụ (Loại cảnh báo & Mức độ) */}
      <BottomSheet visible={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">
            {t('Bộ lọc nâng cao')}
          </Text>
        </View>

        <View style={styles.bottomSheetBody}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {t('Loại cảnh báo suy luận')}
          </Text>
          <View style={styles.sheetChipGroup}>
            {INFERRED_TYPE_OPTIONS.map(opt => {
              const active = selectedType === opt.key
              return (
                <Pressable
                  key={opt.key}
                  hitSlop={8}
                  onPress={() => setSelectedType(opt.key)}
                  style={[styles.sheetChip, { backgroundColor: active ? palette.inverse : palette.surfaceStrong }]}
                >
                  <Text variant="body" weight="semiBold" color={active ? palette.onInverse : palette.text}>
                    {t(opt.label)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={{ marginTop: Spacing.md }}>
            {t('Mức độ nghiêm trọng')}
          </Text>
          <View style={styles.sheetChipGroup}>
            {SEVERITY_OPTIONS.map(opt => {
              const active = selectedSeverity === opt.key
              return (
                <Pressable
                  key={opt.key}
                  hitSlop={8}
                  onPress={() => setSelectedSeverity(opt.key)}
                  style={[styles.sheetChip, { backgroundColor: active ? palette.inverse : palette.surfaceStrong }]}
                >
                  <Text variant="body" weight="semiBold" color={active ? palette.onInverse : palette.text}>
                    {t(opt.label)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.sheetActions}>
            <Button
              label={t('Đặt lại')}
              variant="secondary"
              onPress={() => {
                setSelectedType('ALL')
                setSelectedSeverity('ALL')
                setIsFilterSheetOpen(false)
              }}
              style={styles.sheetResetButton}
            />
            <Button
              label={t('Áp dụng')}
              variant="primary"
              onPress={() => setIsFilterSheetOpen(false)}
              style={styles.sheetApplyButton}
            />
          </View>
        </View>
      </BottomSheet>

      {toastMessage && <Toast message={toastMessage} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stickyScopeContainer: {
    zIndex: 10,
  },
  mainContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiCell: {
    flexGrow: 1,
    flexBasis: '40%',
  },
  kpiTile: {
    height: KPI_TILE_HEIGHT,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  kpiValue: {
    fontVariant: ['tabular-nums'],
  },
  kpiCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  filterSection: {
    marginBottom: Spacing.md,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  advancedFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertListSection: {
    marginTop: Spacing.xs,
  },
  skeletonWrapper: {
    gap: Spacing.md,
  },
  sheetHeader: {
    marginBottom: Spacing.xs,
  },
  bottomSheetBody: {
    paddingVertical: Spacing.sm,
  },
  sheetChipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sheetChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  sheetResetButton: {
    flex: 1,
  },
  sheetApplyButton: {
    flex: 1,
  },
})
