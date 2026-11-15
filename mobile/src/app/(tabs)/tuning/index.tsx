import { useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import {
  ArrowCounterClockwise,
  CheckCircle,
  FloppyDisk,
  Lightning,
  SlidersHorizontal,
  Sparkle,
  ToggleLeft,
  ToggleRight,
  Warning,
  WarningCircle,
} from 'phosphor-react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ExpertHeaderPicker, PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { StepperInput } from '@/components/ui/stepper-input'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useTuningScreen, type TuningChipKey } from '@/hooks/expert/useTuningScreen'
import { t } from '@/utils/i18n.utils'
import { TUNING_GROUPS_METADATA } from '@/utils/tuning.utils'

const KPI_TILE_HEIGHT = 112
const ICON_BOX_SIZE = 44

const CHIP_ITEMS: { key: TuningChipKey; label: string }[] = [
  { key: 'thresholds', label: 'Ngưỡng nhiệt ẩm' },
  { key: 'fuzzy', label: 'Độ ẩm & Gió' },
  { key: 'detection', label: 'Bắt lỗi' },
]

/**
 * [PHẦN 3] MOBILE — MENU THAM SỐ (src/app/(tabs)/tuning/index.tsx)
 * Kiến trúc 1 màn hình duy nhất (One-Screen Consolidated) cho Domain Expert,
 * đồng bộ 100% quy chuẩn thẩm mỹ Calm Industrial (SettingsSection + KpiTile + ChoiceChips) với nhánh FARM_OWNER.
 */
export default function TuningScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const params = useLocalSearchParams<{ zoneId?: string; chip?: string }>()

  const {
    activeZoneId,
    hasZoneData,
    isZoneLoading,
    isZoneError,
    isRefetching,
    refetch,
    getFieldValue,
    handleParamChange,
    fuzzyInputFilter,
    toggleFuzzyInputFilter,
    isDirty,
    totalDirtyCount,
    isSaving,
    saveAndApply,
    resetLocal,
    resetSystemDefaults,
    isResetting,
    isApplyingSuggestion,
    suggestedValues,
    aiR2,
    aiInRangeNow,
    aiInRangeSuggested,
    aiDeltaPct,
    aiReasonText,
    applyAiFuzzySuggestion,
    kpiInRangePct,
    kpiBreachedCount,
    kpiOwnerReviewsCount,
    kpiAiAvailable,
    toastMessage,
  } = useTuningScreen(params.zoneId)

  const [selectedChip, setSelectedChip] = useState<TuningChipKey>(() => {
    if (params.chip === 'fuzzy' || params.chip === 'detection') return params.chip
    return 'thresholds'
  })

  const [prevParamChip, setPrevParamChip] = useState(params.chip)
  if (params.chip !== prevParamChip) {
    setPrevParamChip(params.chip)
    if (params.chip === 'fuzzy' || params.chip === 'detection' || params.chip === 'thresholds') {
      setSelectedChip(params.chip)
    }
  }

  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  const handleResetSystemDefaults = () => {
    setIsResetModalOpen(false)
    void resetSystemDefaults()
  }

  const breachedWarning = kpiBreachedCount > 0
  const breachedSecondaryColor = breachedWarning ? palette.severityP2Text : palette.textSecondary

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader leading={<ExpertHeaderPicker />} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch() }} tintColor={palette.text} />}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 + (isDirty ? 72 : 0) },
        ]}
      >
        <View style={[styles.stickyHeaderContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar requireZone />
        </View>

        {!activeZoneId ? (
          <View style={styles.emptyContainer}>
            <EmptyState message={t('Vui lòng chọn một Tầng / Zone để xem và hiệu chỉnh tham số vận hành.')} />
          </View>
        ) : isZoneError ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              message={t('Không tải được tham số vận hành. Vui lòng kéo xuống để thử lại.')}
              actionLabel={t('Thử lại')}
              onAction={() => { void refetch() }}
            />
          </View>
        ) : isZoneLoading && !hasZoneData ? (
          <View style={styles.loadingContainer}>
            <Skeleton width="100%" height={160} radius={Radius.lg} />
            <Skeleton width="100%" height={48} radius={Radius.full} />
            <Skeleton width="100%" height={320} radius={Radius.lg} />
          </View>
        ) : (
          <>
            {/* KHỐI 2: Lưới 2x2 gồm 4 Ô KPI chuẩn KpiTile của FARM_OWNER */}
            <View style={styles.kpiGrid}>
              {/* Ô 1: Trong dải chuẩn */}
              <View style={styles.kpiCell}>
                <View style={[styles.kpiTile, { backgroundColor: palette.surface }]}>
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {t('Trong dải chuẩn')}
                  </Text>
                  <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                    {kpiInRangePct != null ? `${kpiInRangePct.toFixed(1)}%` : '—'}
                  </Text>
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {kpiInRangePct == null
                      ? t('Chưa có kỳ báo cáo')
                      : t('Hiệu quả 7 ngày qua')}
                  </Text>
                </View>
              </View>

              {/* Ô 2: Lệch chuẩn */}
              <View style={styles.kpiCell}>
                <PressableScale
                  onPress={() => setSelectedChip('thresholds')}
                  style={[
                    styles.kpiTile,
                    {
                      backgroundColor: breachedWarning ? palette.severityP2 : palette.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('Chuyển sang nhóm Ngưỡng nhiệt ẩm')}
                >
                  <Text variant="small" color={breachedSecondaryColor} numberOfLines={1}>
                    {t('Lệch chuẩn')}
                  </Text>
                  <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                    {t('{count} cảnh báo', { count: kpiBreachedCount })}
                  </Text>
                  <Text variant="small" color={breachedSecondaryColor} numberOfLines={1}>
                    {kpiBreachedCount > 0 ? t('Cần rà soát ngưỡng') : t('Hoạt động ổn định')}
                  </Text>
                </PressableScale>
              </View>

              {/* Ô 3: Chủ nhà xin đổi */}
              <View style={styles.kpiCell}>
                <View style={[styles.kpiTile, { backgroundColor: palette.surface }]}>
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {t('Chủ nhà xin đổi')}
                  </Text>
                  <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                    {t('{count} yêu cầu', { count: kpiOwnerReviewsCount })}
                  </Text>
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {kpiOwnerReviewsCount > 0 ? t('Chờ thẩm định') : t('Không có thay đổi')}
                  </Text>
                </View>
              </View>

              {/* Ô 4: Gợi ý từ AI */}
              <View style={styles.kpiCell}>
                <PressableScale
                  onPress={() => setSelectedChip('fuzzy')}
                  style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('Chuyển sang nhóm Độ ẩm & Gió')}
                >
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {t('Gợi ý từ AI')}
                  </Text>
                  <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                    {kpiAiAvailable ? t('1 đề xuất') : t('Đang học')}
                  </Text>
                  <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                    {kpiAiAvailable ? t('Sẵn sàng áp dụng') : t('Thu thập dữ liệu')}
                  </Text>
                </PressableScale>
              </View>
            </View>

            {/* Hàng Chip chọn nhóm tham số chuẩn ChoiceChips của FARM_OWNER */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContainer}>
              {CHIP_ITEMS.map(item => {
                const isSelected = selectedChip === item.key
                return (
                  <Pressable
                    key={item.key}
                    hitSlop={8}
                    onPress={() => setSelectedChip(item.key)}
                    style={[
                      styles.chipButton,
                      {
                        backgroundColor: isSelected ? palette.inverse : palette.surface,
                      },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      variant="body"
                      weight="semiBold"
                      color={isSelected ? palette.onInverse : palette.text}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.controlsArea}>
              {selectedChip === 'fuzzy' && suggestedValues ? (
                <Card style={[styles.aiSuggestionCard, { marginBottom: Spacing.sm }]}>
                  <View style={styles.aiHeaderRow}>
                    <View style={[styles.aiTag, { backgroundColor: palette.primary }]}>
                      <Sparkle size={14} color={palette.onPrimary} weight="bold" />
                      <Text variant="label" weight="bold" color={palette.onPrimary}>
                        {t('Gợi ý tự động từ AI')}
                      </Text>
                    </View>
                    {aiR2 != null ? (
                      <Text variant="small" weight="semiBold" color={palette.text}>
                        {`Độ tin cậy: ${Math.round(aiR2 * 100)}%`}
                      </Text>
                    ) : null}
                  </View>
                  {aiInRangeNow != null && aiInRangeSuggested != null ? (
                    <Text variant="body" weight="semiBold" color={palette.text}>
                      {t('Đạt chuẩn dự kiến: {now}% → {next}%', {
                        now: Math.round(aiInRangeNow),
                        next: Math.round(aiInRangeSuggested),
                      })}
                    </Text>
                  ) : aiDeltaPct != null ? (
                    <Text variant="body" weight="semiBold" color={palette.text}>
                      {t('Dự kiến tăng thời gian đạt chuẩn vi khí hậu lên {pct}%', {
                        pct: aiDeltaPct > 0 ? `+${aiDeltaPct.toFixed(1)}` : aiDeltaPct.toFixed(1),
                      })}
                    </Text>
                  ) : null}
                  {aiReasonText ? (
                    <Text variant="small" color={palette.textSecondary}>
                      {aiReasonText}
                    </Text>
                  ) : null}
                  <Button
                    label={t('Áp dụng gợi ý này')}
                    onPress={applyAiFuzzySuggestion}
                    loading={isApplyingSuggestion}
                    disabled={isApplyingSuggestion}
                    variant="primary"
                    size="md"
                    trailingIcon={Lightning}
                  />
                </Card>
              ) : null}

              <View style={styles.groupContainer}>
                {TUNING_GROUPS_METADATA[selectedChip].map(card => {
                  const isGood = card.statusType === 'good'
                  const isWatch = card.statusType === 'watch'
                  const isAction = card.statusType === 'action'
                  const IconComp = isGood ? CheckCircle : isWatch ? WarningCircle : isAction ? Warning : SlidersHorizontal
                  const iconBoxBg = isAction ? palette.severityP2 : palette.primary
                  const iconBoxColor = isAction ? palette.alert : palette.onPrimary

                  return (
                    <Card key={card.id} style={styles.paramGroupCard}>
                      {/* Header đồng bộ 100% với SettingsSection.tsx của FARM_OWNER */}
                      <View style={styles.sectionHeaderRow}>
                        <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>
                          <IconComp size={22} color={iconBoxColor} weight="bold" />
                        </View>
                        <View style={styles.sectionHeaderText}>
                          <Text variant="body" weight="semiBold">
                            {t(card.title)}
                          </Text>
                          <Text variant="small" color={palette.textSecondary}>
                            {t(card.description)}
                          </Text>
                        </View>
                      </View>

                      {card.fields.map(field => (
                        <StepperInput
                          key={field.key}
                          label={t(field.label)}
                          value={getFieldValue(selectedChip, field.key, field.default)}
                          onChange={val => handleParamChange(selectedChip, field.key, val)}
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          unit={field.unit}
                          defaultValue={field.default}
                          decimals={field.decimals}
                        />
                      ))}

                      {card.id === 'fuzzy_drying' && (
                        <View style={[styles.toggleRow, { borderTopColor: palette.divider }]}>
                          <View style={styles.toggleTextContainer}>
                            <Text variant="body" weight="medium">
                              {t('Lọc tín hiệu cảm biến (chống nhảy số ảo)')}
                            </Text>
                            <Text variant="small" color={palette.textSecondary}>
                              {t('Tự động làm mượt số liệu khi cảm biến chập chờn hoặc nhiễu tức thời.')}
                            </Text>
                          </View>
                          <Pressable
                            hitSlop={8}
                            onPress={toggleFuzzyInputFilter}
                            accessibilityRole="switch"
                            accessibilityState={{ checked: fuzzyInputFilter }}
                            accessibilityLabel={t('Bật tắt lọc tín hiệu cảm biến')}
                          >
                            {fuzzyInputFilter ? (
                              <ToggleRight size={36} color={palette.text} weight="fill" />
                            ) : (
                              <ToggleLeft size={36} color={palette.textSecondary} weight="regular" />
                            )}
                          </Pressable>
                        </View>
                      )}
                    </Card>
                  )
                })}

                {selectedChip === 'thresholds' ? (
                  <View style={{ marginTop: Spacing.xs }}>
                    <Button
                      variant="secondary"
                      label={t('Khôi phục dải chuẩn SwiftletCare')}
                      onPress={() => setIsResetModalOpen(true)}
                      loading={isResetting}
                      disabled={isResetting}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Thanh Lưu thay đổi phẳng tuyệt đối (không shadow/elevation), chuẩn TAB_BAR_OVERLAP */}
      {isDirty ? (
        <View style={[styles.floatingDock, { backgroundColor: palette.inverse, bottom: TAB_BAR_OVERLAP + Spacing.md }]}>
          <View style={styles.dockInfo}>
            <Text variant="body" weight="semiBold" color={palette.onInverse}>
              {t('{count} thay đổi chưa lưu', { count: totalDirtyCount })}
            </Text>
            <Text variant="small" color={palette.onInverseSecondary}>
              {t('Sẵn sàng áp dụng cho nhà yến')}
            </Text>
          </View>

          <View style={styles.dockActions}>
            <PressableScale
              onPress={resetLocal}
              disabled={isSaving}
              style={[styles.dockSecondaryBtn, { backgroundColor: palette.surface }]}
              accessibilityRole="button"
              accessibilityLabel={t('Khôi phục lại giá trị chưa sửa')}
            >
              <ArrowCounterClockwise size={16} color={palette.text} weight="bold" />
              <Text variant="small" weight="semiBold" color={palette.text}>
                {t('Khôi phục')}
              </Text>
            </PressableScale>

            <PressableScale
              onPress={saveAndApply}
              disabled={isSaving}
              style={[styles.dockPrimaryBtn, { backgroundColor: palette.primary, opacity: isSaving ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('Lưu và áp dụng cấu hình')}
            >
              <FloppyDisk size={16} color={palette.onPrimary} weight="bold" />
              <Text variant="small" weight="semiBold" color={palette.onPrimary}>
                {isSaving ? t('Đang lưu...') : t('Lưu & áp dụng')}
              </Text>
            </PressableScale>
          </View>
        </View>
      ) : null}

      {/* BottomSheet xác nhận đặt lại dải chuẩn đồng bộ toàn app */}
      <BottomSheet visible={isResetModalOpen} onClose={() => setIsResetModalOpen(false)}>
        <View style={styles.sheetTitleRow}>
          <Warning size={20} color={palette.alert} weight="bold" />
          <Text variant="heading" weight="semiBold">
            {t('Đặt lại theo dải chuẩn SwiftletCare?')}
          </Text>
        </View>
        <Text variant="body" color={palette.textSecondary}>
          {t('Toàn bộ ngưỡng nhiệt ẩm của tầng này sẽ được đặt lại theo tiêu chuẩn tối ưu của SwiftletCare.')}
        </Text>
        <View style={styles.sheetButtons}>
          <Button
            label={t('Hủy')}
            variant="secondary"
            onPress={() => setIsResetModalOpen(false)}
            style={styles.sheetBtn}
          />
          <Button
            label={t('Khôi phục ngay')}
            variant="primary"
            onPress={handleResetSystemDefaults}
            style={styles.sheetBtn}
          />
        </View>
      </BottomSheet>

      {toastMessage && (
        <Toast
          message={toastMessage}
          bottomOffset={TAB_BAR_OVERLAP + (isDirty ? 88 : Spacing.lg)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stickyHeaderContainer: { zIndex: 40 },
  scrollContent: { gap: Spacing.sm },
  emptyContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xl },
  loadingContainer: { paddingHorizontal: Spacing.md, gap: Spacing.md, paddingTop: Spacing.md },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
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
  chipsScrollContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chipButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsArea: { paddingHorizontal: Spacing.md },
  groupContainer: { gap: Spacing.md },
  paramGroupCard: { padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  aiSuggestionCard: { padding: Spacing.lg, borderRadius: Radius.lg, gap: Spacing.sm },
  aiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: BorderWidth.hairline,
  },
  toggleTextContainer: { flex: 1, paddingRight: Spacing.sm },
  floatingDock: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 50,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockInfo: { flex: 1, paddingRight: Spacing.xs },
  dockActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dockSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.full,
  },
  dockPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: Radius.full,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sheetBtn: { flex: 1 },
})
