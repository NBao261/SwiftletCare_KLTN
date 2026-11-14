import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { onNotificationNew } from '@/services/socket/socketClient'
import {
  ArrowUp,
  SlidersHorizontal,
} from 'phosphor-react-native'
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
import { useInferredAlerts, useSetAlertVerdict, useVerdictStats } from '@/hooks/expert/useInferredAlerts'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { InferredAlert, VerdictResult } from '@/types'
import { t } from '@/utils/i18n.utils'

const KPI_TILE_HEIGHT = 112

type FilterStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED'

// Chỉ 4 loại cảnh báo suy luận cần kiểm chứng — MISTING_INEFFECTIVE là device alert, không thuộc inferred types (api-spec.yaml dòng 3105)
const INFERRED_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả loại sự cố' },
  { key: 'NOISE_ANOMALY', label: 'Tiếng ồn bất thường trong nhà' },
  { key: 'SENSOR_ANOMALY', label: 'Cảm biến nhảy số bất thường' },
  { key: 'LOW_RETURN_RATE', label: 'Đàn chim về tổ sụt giảm' },
  { key: 'FORECAST_BREACH', label: 'Dự báo sắp lệch nhiệt ẩm' },
]

const INFERRED_ALERT_TYPES = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE'] as const

const SEVERITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả mức độ' },
  { key: 'CRITICAL', label: 'Khẩn cấp' },
  { key: 'HIGH', label: 'Cao' },
  { key: 'MEDIUM', label: 'Trung bình' },
  { key: 'LOW', label: 'Thường' },
]

/**
 * [PHẦN 2] MOBILE — MENU THẨM ĐỊNH (src/app/(tabs)/verdicts/index.tsx)
 * Kiến trúc 1 màn hình duy nhất (One-Screen Consolidated) cho Domain Expert,
 * đồng bộ 100% quy chuẩn thẩm mỹ Calm Industrial với nhánh FARM_OWNER.
 */
export default function VerdictsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const params = useLocalSearchParams<{ alertId?: string }>()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const cardLayouts = useRef<Record<string, number>>({})
  const listSectionY = useRef(0)

  const queryClient = useQueryClient()

  // Realtime WebSocket: tự động làm mới danh sách thẩm định khi có thông báo mới (EXPERT-FR-007)
  useEffect(() => {
    const handleNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ['inferred-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['verdict-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['expert'] })
    }
    const unsubscribe = onNotificationNew(handleNotification)
    return unsubscribe
  }, [queryClient])

  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

  const [userToggledAlertId, setUserToggledAlertId] = useState<string | null | undefined>(undefined)
  const expandedAlertId = userToggledAlertId !== undefined ? userToggledAlertId : (params.alertId ?? null)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const {
    data: alertsResponse,
    isLoading: isAlertsLoading,
    isRefetching,
    refetch,
  } = useInferredAlerts({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  const { refetch: refetchStats } = useVerdictStats({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  const setAlertVerdict = useSetAlertVerdict()

  const rawAlerts: InferredAlert[] = useMemo(() => {
    const alerts = alertsResponse?.data || []
    // Chỉ giữ lại 4 loại inferred type thực sự cần kiểm chứng (api-spec.yaml dòng 3105/3303)
    return alerts.filter(a => (INFERRED_ALERT_TYPES as readonly string[]).includes(a.type))
  }, [alertsResponse])

  const kpiData = useMemo(() => {
    let pending = 0
    let confirmed = 0
    let rejected = 0

    rawAlerts.forEach(a => {
      if (!a.expert_verdict) {
        pending += 1
      } else if (a.expert_verdict.result === 'CONFIRMED') {
        confirmed += 1
      } else if (a.expert_verdict.result === 'REJECTED') {
        rejected += 1
      }
    })

    const total = rawAlerts.length
    const evaluatedTotal = confirmed + rejected
    const confirmRate = evaluatedTotal > 0 ? Math.round((confirmed / evaluatedTotal) * 100) : 0

    return {
      total,
      pending,
      confirmed,
      rejected,
      confirmRate,
    }
  }, [rawAlerts])

  const filteredAlerts = useMemo(() => {
    return rawAlerts.filter(item => {
      if (filterStatus === 'PENDING' && Boolean(item.expert_verdict)) return false
      if (filterStatus === 'CONFIRMED' && item.expert_verdict?.result !== 'CONFIRMED') return false
      if (filterStatus === 'REJECTED' && item.expert_verdict?.result !== 'REJECTED') return false

      if (selectedType !== 'ALL' && item.type !== selectedType) return false
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) return false

      return true
    })
  }, [filterStatus, rawAlerts, selectedSeverity, selectedType])

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

  const handleVerdictSubmit = useCallback(
    async (alertId: string, result: VerdictResult, note?: string) => {
      try {
        await setAlertVerdict.mutateAsync({ alertId, result, note })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
        showToast(
          result === 'CONFIRMED'
            ? t('Đã xác nhận cảnh báo đúng')
            : t('Đã bác bỏ cảnh báo ảo và gửi lý do')
        )
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
        showToast(t('Không thể lưu kết luận thẩm định, vui lòng thử lại'))
      }
    },
    [setAlertVerdict, showToast]
  )

  const handleKpiPress = useCallback((status: FilterStatus) => {
    setFilterStatus(status)
    scrollRef.current?.scrollTo({ y: Math.max(0, listSectionY.current - 12), animated: true })
  }, [])

  const pendingTileWarning = kpiData.pending > 0
  const pendingSecondaryColor = pendingTileWarning ? palette.severityP2Text : palette.textSecondary
  const hasAdvancedFilter = selectedType !== 'ALL' || selectedSeverity !== 'ALL'

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader leading={<ExpertHeaderPicker />} />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch()
              refetchStats()
            }}
            tintColor={palette.text}
          />
        }
      >
        {/* KHỐI 1: Thanh chọn Tầng & Khoảng thời gian ghim cố định đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Ô KPI chuẩn KpiTile của FARM_OWNER */}
          <View style={styles.kpiGrid}>
            {/* Ô 1: Tổng cảnh báo */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('ALL')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Lọc tất cả cảnh báo')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Tổng cảnh báo')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} sự cố', { count: kpiData.total })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Đã ghi nhận')}
                </Text>
              </PressableScale>
            </View>

            {/* Ô 2: Chờ kiểm tra */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => handleKpiPress('PENDING')}
                style={[
                  styles.kpiTile,
                  {
                    backgroundColor: pendingTileWarning ? palette.severityP2 : palette.surface,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('Lọc cảnh báo chờ kiểm tra')}
              >
                <Text variant="small" color={pendingSecondaryColor} numberOfLines={1}>
                  {t('Chờ kiểm tra')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đang mở', { count: kpiData.pending })}
                </Text>
                <Text variant="small" color={pendingSecondaryColor} numberOfLines={1}>
                  {kpiData.pending > 0 ? t('Cần chuyên gia xem') : t('Đã xử lý hết')}
                </Text>
              </PressableScale>
            </View>

            {/* Ô 3: Tỷ lệ báo đúng (%) */}
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
                  {`${kpiData.confirmRate}%`}
                </Text>
                <View style={styles.kpiCaptionRow}>
                  <ArrowUp size={12} color={palette.houseHealthy} weight="bold" />
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {t('Tỷ lệ chuẩn xác')}
                  </Text>
                </View>
              </PressableScale>
            </View>

            {/* Ô 4: Báo ảo (Bác bỏ) */}
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
                  {t('{count} đã loại', { count: kpiData.rejected })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo sai / nhiễu')}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* KHỐI 3: Hàng Filter Chips bo tròn không viền chuẩn ChoiceChips của FARM_OWNER */}
          <View
            onLayout={e => {
              listSectionY.current = e.nativeEvent.layout.y
            }}
            style={styles.filterSection}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {/* Chip: Tất cả */}
              <Pressable
                hitSlop={8}
                onPress={() => setFilterStatus('ALL')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'ALL' ? palette.inverse : palette.surface,
                  },
                ]}
              >
                <Text
                  variant="body"
                  weight="semiBold"
                  color={filterStatus === 'ALL' ? palette.onInverse : palette.text}
                >
                  {t('Tất cả ({count})', { count: kpiData.total })}
                </Text>
              </Pressable>

              {/* Chip: Chờ kiểm tra */}
              <Pressable
                hitSlop={8}
                onPress={() => setFilterStatus('PENDING')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'PENDING' ? palette.inverse : palette.surface,
                  },
                ]}
              >
                <Text
                  variant="body"
                  weight="semiBold"
                  color={filterStatus === 'PENDING' ? palette.onInverse : palette.text}
                >
                  {t('Chờ kiểm tra ({count})', { count: kpiData.pending })}
                </Text>
              </Pressable>

              {/* Chip: Báo đúng */}
              <Pressable
                hitSlop={8}
                onPress={() => setFilterStatus('CONFIRMED')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'CONFIRMED' ? palette.inverse : palette.surface,
                  },
                ]}
              >
                <Text
                  variant="body"
                  weight="semiBold"
                  color={filterStatus === 'CONFIRMED' ? palette.onInverse : palette.text}
                >
                  {t('Báo đúng ({count})', { count: kpiData.confirmed })}
                </Text>
              </Pressable>

              {/* Chip: Báo ảo */}
              <Pressable
                hitSlop={8}
                onPress={() => setFilterStatus('REJECTED')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'REJECTED' ? palette.inverse : palette.surface,
                  },
                ]}
              >
                <Text
                  variant="body"
                  weight="semiBold"
                  color={filterStatus === 'REJECTED' ? palette.onInverse : palette.text}
                >
                  {t('Báo ảo ({count})', { count: kpiData.rejected })}
                </Text>
              </Pressable>

              {/* Nút Lọc nâng cao */}
              <Pressable
                hitSlop={8}
                onPress={() => setIsFilterSheetOpen(true)}
                style={[
                  styles.filterChip,
                  styles.advancedFilterButton,
                  {
                    backgroundColor: hasAdvancedFilter ? palette.inverse : palette.surface,
                  },
                ]}
              >
                <SlidersHorizontal
                  size={14}
                  weight="bold"
                  color={hasAdvancedFilter ? palette.onInverse : palette.text}
                />
                <Text
                  variant="body"
                  weight="semiBold"
                  color={hasAdvancedFilter ? palette.onInverse : palette.text}
                >
                  {t('Bộ lọc')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* KHỐI 4: Danh sách Card Cảnh báo tích hợp Inline Collapsible Evidence Drawer */}
          <View style={styles.alertListSection}>
            {isAlertsLoading ? (
              <View style={styles.skeletonWrapper}>
                <Skeleton width="100%" height={120} radius={Radius.lg} />
                <View style={{ height: Spacing.md }} />
                <Skeleton width="100%" height={120} radius={Radius.lg} />
                <View style={{ height: Spacing.md }} />
                <Skeleton width="100%" height={120} radius={Radius.lg} />
              </View>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                message={t('Không tìm thấy sự cố nào thỏa mãn bộ lọc hiện tại.')}
              />
            ) : (
              filteredAlerts.map(alert => (
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
                    onVerdictSubmit={handleVerdictSubmit}
                    isSubmitting={setAlertVerdict.isPending}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* BottomSheet: Bộ lọc phụ gọn gàng (Loại cảnh báo & Mức độ) */}
      <BottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
      >
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
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: active ? palette.inverse : palette.surfaceStrong,
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    weight="semiBold"
                    color={active ? palette.onInverse : palette.text}
                  >
                    {opt.label}
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
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: active ? palette.inverse : palette.surfaceStrong,
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    weight="semiBold"
                    color={active ? palette.onInverse : palette.text}
                  >
                    {opt.label}
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

      {toastMessage && (
        <Toast message={toastMessage} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />
      )}
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
