import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  CheckCircle,
  Lightning,
  SlidersHorizontal,
  WarningCircle,
  XCircle,
} from 'phosphor-react-native'
import { PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { VerdictCard } from '@/components/expert/VerdictCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useInferredAlerts, useSetAlertVerdict, useVerdictStats } from '@/hooks/expert/useInferredAlerts'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { InferredAlert, VerdictResult } from '@/types'
import { t } from '@/utils/i18n.utils'

type FilterStatus = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED'

const INFERRED_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả loại sự cố' },
  { key: 'NOISE_ANOMALY', label: 'Dị thường âm thanh' },
  { key: 'SENSOR_ANOMALY', label: 'Cảm biến sai lệch' },
  { key: 'MISTING_INEFFECTIVE', label: 'Bơm sương không hiệu quả' },
  { key: 'LOW_RETURN_RATE', label: 'Tỷ lệ chim về thấp' },
  { key: 'FORECAST_BREACH', label: 'Dự báo vi phạm vi khí hậu' },
]

const SEVERITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả mức độ' },
  { key: 'CRITICAL', label: 'Khẩn cấp (P1)' },
  { key: 'HIGH', label: 'Cao (P1)' },
  { key: 'MEDIUM', label: 'Trung bình (P2)' },
  { key: 'LOW', label: 'Thường (P3)' },
]

/**
 * [PHẦN 2] MOBILE — MENU THẨM ĐỊNH (src/app/(tabs)/verdicts/index.tsx)
 * Kiến trúc 1 màn hình duy nhất (One-Screen Consolidated) cho Domain Expert.
 * Đáp ứng EXPERT-FR-003, ALERT-FR-007, ALERT-FR-014, EXPERT-FR-008, BR-16.
 */
export default function VerdictsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const params = useLocalSearchParams<{ alertId?: string }>()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const cardLayouts = useRef<Record<string, number>>({})

  // Phạm vi giám sát dùng chung (PersistentScopeBar)
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)

  // Trạng thái lọc danh sách
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

  // Quản lý thẻ mở rộng (Collapsible Drawer)
  const [userToggledAlertId, setUserToggledAlertId] = useState<string | null | undefined>(undefined)
  const expandedAlertId = userToggledAlertId !== undefined ? userToggledAlertId : (params.alertId ?? null)

  // Nạp danh sách cảnh báo suy luận từ API
  const {
    data: alertsResponse,
    isLoading: isAlertsLoading,
    isRefetching,
    refetch,
  } = useInferredAlerts({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  // Thống kê phán quyết chuyên gia (EXPERT-FR-008)
  const { refetch: refetchStats } = useVerdictStats({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  const setAlertVerdict = useSetAlertVerdict()

  const rawAlerts: InferredAlert[] = useMemo(() => {
    return alertsResponse?.data || []
  }, [alertsResponse])

  // Tính toán số liệu cho 4 thẻ KPI phản xạ nhanh (Khối 2)
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

  // Lọc danh sách theo các tiêu chí đã chọn
  const filteredAlerts = useMemo(() => {
    return rawAlerts.filter(item => {
      // 1. Lọc theo trạng thái phán quyết
      if (filterStatus === 'PENDING' && Boolean(item.expert_verdict)) return false
      if (filterStatus === 'CONFIRMED' && item.expert_verdict?.result !== 'CONFIRMED') return false
      if (filterStatus === 'REJECTED' && item.expert_verdict?.result !== 'REJECTED') return false

      // 2. Lọc theo loại cảnh báo
      if (selectedType !== 'ALL' && item.type !== selectedType) return false

      // 3. Lọc theo mức độ nghiêm trọng
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) return false

      return true
    })
  }, [filterStatus, rawAlerts, selectedSeverity, selectedType])

  // Xử lý tự động cuộn tới vị trí thẻ khi nhận params.alertId từ màn Hàng đợi
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
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
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      }
    },
    [setAlertVerdict]
  )

  const handleKpiPress = useCallback((status: FilterStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    setFilterStatus(status)
  }, [])

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Thẩm định cảnh báo AI')} />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xxl * 3 }]}
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
        {/* KHỐI 1: PersistentScopeBar ghim cố định đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Thẻ KPI Phản Xạ Nhanh */}
          <View style={styles.kpiGrid}>
            {/* Thẻ 1: Tổng cảnh báo */}
            <Pressable
              onPress={() => handleKpiPress('ALL')}
              style={({ pressed }) => [
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: filterStatus === 'ALL' ? palette.text : palette.border,
                  borderWidth: filterStatus === 'ALL' ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Lọc tất cả cảnh báo')}
            >
              <View style={styles.kpiHeader}>
                <Lightning size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('TỔNG CẢNH BÁO')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {kpiData.total.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Sự cố suy luận')}
              </Text>
            </Pressable>

            {/* Thẻ 2: Chờ thẩm định (dùng màu palette.alert nếu > 0) */}
            <Pressable
              onPress={() => handleKpiPress('PENDING')}
              style={({ pressed }) => [
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: filterStatus === 'PENDING' ? palette.alert : palette.border,
                  borderWidth: filterStatus === 'PENDING' ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Lọc cảnh báo chờ thẩm định')}
            >
              <View style={styles.kpiHeader}>
                <WarningCircle
                  size={16}
                  weight="bold"
                  color={kpiData.pending > 0 ? palette.alert : palette.text}
                />
                <Text
                  variant="label"
                  weight="bold"
                  color={kpiData.pending > 0 ? palette.alert : palette.textSecondary}
                >
                  {t('CHỜ THẨM ĐỊNH')}
                </Text>
              </View>
              <Text
                variant="display"
                weight="bold"
                color={kpiData.pending > 0 ? palette.alert : palette.text}
                style={styles.kpiValue}
              >
                {kpiData.pending.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Cần phán quyết')}
              </Text>
            </Pressable>

            {/* Thẻ 3: Tỷ lệ xác nhận (%) */}
            <Pressable
              onPress={() => handleKpiPress('CONFIRMED')}
              style={({ pressed }) => [
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: filterStatus === 'CONFIRMED' ? palette.text : palette.border,
                  borderWidth: filterStatus === 'CONFIRMED' ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Lọc cảnh báo đã xác nhận')}
            >
              <View style={styles.kpiHeader}>
                <CheckCircle size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('XÁC NHẬN')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {`${kpiData.confirmRate}%`}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Tỷ lệ chuẩn xác')}
              </Text>
            </Pressable>

            {/* Thẻ 4: Đã bác bỏ */}
            <Pressable
              onPress={() => handleKpiPress('REJECTED')}
              style={({ pressed }) => [
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: filterStatus === 'REJECTED' ? palette.text : palette.border,
                  borderWidth: filterStatus === 'REJECTED' ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Lọc cảnh báo đã bác bỏ')}
            >
              <View style={styles.kpiHeader}>
                <XCircle size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('ĐÃ BÁC BỎ')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {kpiData.rejected.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Báo sai / Loại trừ')}
              </Text>
            </Pressable>
          </View>

          {/* KHỐI 3: Hàng Filter Chips bo tròn Radius.full & Nút Lọc phụ */}
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {/* Chip: Tất cả */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
                  setFilterStatus('ALL')
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'ALL' ? palette.text : palette.surface,
                    borderColor: filterStatus === 'ALL' ? palette.text : palette.border,
                  },
                ]}
              >
                <Text
                  variant="small"
                  weight={filterStatus === 'ALL' ? 'bold' : 'medium'}
                  color={filterStatus === 'ALL' ? palette.onInverse : palette.text}
                >
                  {t('Tất cả ({count})', { count: kpiData.total })}
                </Text>
              </Pressable>

              {/* Chip: Chờ xử lý */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
                  setFilterStatus('PENDING')
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'PENDING' ? palette.text : palette.surface,
                    borderColor: filterStatus === 'PENDING' ? palette.text : palette.border,
                  },
                ]}
              >
                <Text
                  variant="small"
                  weight={filterStatus === 'PENDING' ? 'bold' : 'medium'}
                  color={filterStatus === 'PENDING' ? palette.onInverse : palette.text}
                >
                  {t('Chờ xử lý ({count})', { count: kpiData.pending })}
                </Text>
              </Pressable>

              {/* Chip: Đã xác nhận */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
                  setFilterStatus('CONFIRMED')
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'CONFIRMED' ? palette.text : palette.surface,
                    borderColor: filterStatus === 'CONFIRMED' ? palette.text : palette.border,
                  },
                ]}
              >
                <Text
                  variant="small"
                  weight={filterStatus === 'CONFIRMED' ? 'bold' : 'medium'}
                  color={filterStatus === 'CONFIRMED' ? palette.onInverse : palette.text}
                >
                  {t('Đã xác nhận ({count})', { count: kpiData.confirmed })}
                </Text>
              </Pressable>

              {/* Chip: Đã bác bỏ */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
                  setFilterStatus('REJECTED')
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterStatus === 'REJECTED' ? palette.text : palette.surface,
                    borderColor: filterStatus === 'REJECTED' ? palette.text : palette.border,
                  },
                ]}
              >
                <Text
                  variant="small"
                  weight={filterStatus === 'REJECTED' ? 'bold' : 'medium'}
                  color={filterStatus === 'REJECTED' ? palette.onInverse : palette.text}
                >
                  {t('Đã bác bỏ ({count})', { count: kpiData.rejected })}
                </Text>
              </Pressable>

              {/* Nút Lọc nâng cao */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
                  setIsFilterSheetOpen(true)
                }}
                style={[
                  styles.filterChip,
                  styles.advancedFilterButton,
                  {
                    backgroundColor:
                      selectedType !== 'ALL' || selectedSeverity !== 'ALL'
                        ? palette.primary
                        : palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <SlidersHorizontal
                  size={14}
                  weight="bold"
                  color={
                    selectedType !== 'ALL' || selectedSeverity !== 'ALL'
                      ? palette.onPrimary
                      : palette.text
                  }
                />
                <Text
                  variant="small"
                  weight="bold"
                  color={
                    selectedType !== 'ALL' || selectedSeverity !== 'ALL'
                      ? palette.onPrimary
                      : palette.text
                  }
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
                message={t('Không tìm thấy sự cố suy luận nào thỏa mãn bộ lọc hiện tại.')}
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
          <Text variant="heading" weight="bold">
            {t('Bộ lọc nâng cao')}
          </Text>
        </View>

        <View style={styles.bottomSheetBody}>
          <Text variant="small" weight="bold" color={palette.textSecondary}>
            {t('LOẠI CẢNH BÁO SUY LUẬN')}
          </Text>
          <View style={styles.sheetChipGroup}>
            {INFERRED_TYPE_OPTIONS.map(opt => {
              const active = selectedType === opt.key
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedType(opt.key)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: active ? palette.text : palette.surfaceStrong,
                      borderColor: active ? palette.text : palette.border,
                    },
                  ]}
                >
                  <Text
                    variant="small"
                    weight={active ? 'bold' : 'medium'}
                    color={active ? palette.onInverse : palette.text}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text variant="small" weight="bold" color={palette.textSecondary} style={{ marginTop: Spacing.md }}>
            {t('MỨC ĐỘ NGHIÊM TRỌNG')}
          </Text>
          <View style={styles.sheetChipGroup}>
            {SEVERITY_OPTIONS.map(opt => {
              const active = selectedSeverity === opt.key
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedSeverity(opt.key)}
                  style={[
                    styles.sheetChip,
                    {
                      backgroundColor: active ? palette.text : palette.surfaceStrong,
                      borderColor: active ? palette.text : palette.border,
                    },
                  ]}
                >
                  <Text
                    variant="small"
                    weight={active ? 'bold' : 'medium'}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    elevation: 0,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kpiValue: {
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  filterSection: {
    marginBottom: Spacing.md,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  advancedFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sheetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  sheetResetButton: {
    flex: 1,
    borderRadius: Radius.full,
  },
  sheetApplyButton: {
    flex: 1,
    borderRadius: Radius.full,
  },
})
