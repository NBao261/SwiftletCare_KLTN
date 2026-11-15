import { useRef } from 'react'
import { LayoutChangeEvent, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'
import { useRouter } from 'expo-router'
import {
  CalendarCheck,
  ClipboardText,
  ClockCounterClockwise,
  SlidersHorizontal,
  WarningCircle,
} from 'phosphor-react-native'
import { QueueInferredAlertCard } from '@/components/expert/queue/QueueInferredAlertCard'
import { QueueProposalCard } from '@/components/expert/queue/QueueProposalCard'
import { QueueReportCard } from '@/components/expert/queue/QueueReportCard'
import { QueueReviewCard } from '@/components/expert/queue/QueueReviewCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ExpertHeaderPicker, PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { EmptyState } from '@/components/ui/empty-state'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useQueueScreen } from '@/hooks/expert/useQueueScreen'
import { t } from '@/utils/i18n.utils'

const KPI_TILE_HEIGHT = 112

/**
 * [PHẦN 1] MOBILE — MENU HÀNG ĐỢI (src/app/(tabs)/queue/index.tsx)
 * Màn mỏng: dữ liệu/đếm/hành động nằm trong useQueueScreen; màn chỉ render 4 nhóm việc chờ xử lý.
 */
export default function QueueScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const sectionYPositions = useRef<Record<string, number>>({})

  const {
    alerts,
    reviews,
    proposals,
    reports,
    counts,
    sections,
    isRefreshing,
    refreshAll,
    acceptReview,
    revertReview,
    approveProposal,
    rejectProposal,
    setConclusion,
    isReviewActing,
    isProposalActing,
    isReportActing,
    toastMessage,
  } = useQueueScreen()

  const handleSectionLayout = (key: string, event: LayoutChangeEvent) => {
    sectionYPositions.current[key] = event.nativeEvent.layout.y
  }

  const scrollToSection = (key: string) => {
    const targetY = sectionYPositions.current[key]
    if (targetY != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, targetY - 12), animated: true })
    }
  }

  const alertTileWarning = counts.alerts > 0
  const alertTileSecondary = alertTileWarning ? palette.severityP2Text : palette.textSecondary

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        leading={<ExpertHeaderPicker />}
        right={
          <PressableScale
            onPress={() => router.push('/expert/activity')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Mở nhật ký hoạt động chuyên gia')}
          >
            <ClockCounterClockwise size={22} weight="bold" color={palette.text} />
          </PressableScale>
        }
      />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} tintColor={palette.text} />}
      >
        {/* KHỐI 1: Thanh chọn Tầng ghim cố định đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Ô KPI — số đếm từ meta.total */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('alerts')}
                style={[styles.kpiTile, { backgroundColor: alertTileWarning ? palette.severityP2 : palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách cảnh báo')}
              >
                <Text variant="small" color={alertTileSecondary} numberOfLines={1}>
                  {t('Chờ kiểm tra')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đang mở', { count: counts.alerts })}
                </Text>
                <Text variant="small" color={alertTileSecondary} numberOfLines={1}>
                  {counts.alerts > 0 ? t('Sự cố cần xem ngay') : t('Chưa có cảnh báo')}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('reviews')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách yêu cầu thay đổi')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Chủ nhà xin đổi')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} yêu cầu', { count: counts.reviews })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Chờ duyệt ngưỡng')}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('proposals')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách đề xuất độ ẩm và gió')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Gợi ý độ ẩm & gió')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đề xuất', { count: counts.proposals })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Tự động hóa từ AI')}
                </Text>
              </PressableScale>
            </View>

            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('reports')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách báo cáo chờ kết luận')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo cáo chờ kết luận')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} kỳ', { count: counts.reports })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Đánh giá định kỳ')}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* KHỐI 3: Cảnh báo bất thường */}
          <View onLayout={e => handleSectionLayout('alerts', e)} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <WarningCircle size={18} weight="bold" color={counts.alerts > 0 ? palette.alert : palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Cảnh báo bất thường')}
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: counts.alerts > 0 ? palette.severityP2 : palette.surface }]}>
                <Text variant="label" weight="bold" color={counts.alerts > 0 ? palette.severityP2Text : palette.textSecondary}>
                  {counts.alerts}
                </Text>
              </View>
            </View>

            {sections.alerts.isError ? (
              <EmptyState
                height={80}
                message={t('Không tải được danh sách cảnh báo.')}
                actionLabel={t('Thử lại')}
                onAction={() => { void sections.alerts.refetch() }}
              />
            ) : sections.alerts.isLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={120} radius={Radius.lg} />
              </View>
            ) : alerts.length > 0 ? (
              alerts.map(alert => <QueueInferredAlertCard key={alert._id} alert={alert} />)
            ) : (
              <EmptyState height={80} message={t('Không có cảnh báo bất thường nào cần kiểm tra.')} />
            )}
          </View>

          {/* KHỐI 4: Yêu cầu đổi thông số từ Chủ nhà */}
          <View onLayout={e => handleSectionLayout('reviews', e)} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <ClipboardText size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Yêu cầu đổi thông số từ chủ nhà')}
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: palette.surface }]}>
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {counts.reviews}
                </Text>
              </View>
            </View>

            {sections.reviews.isError ? (
              <EmptyState
                height={80}
                message={t('Không tải được danh sách yêu cầu.')}
                actionLabel={t('Thử lại')}
                onAction={() => { void sections.reviews.refetch() }}
              />
            ) : sections.reviews.isLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={140} radius={Radius.lg} />
              </View>
            ) : reviews.length > 0 ? (
              reviews.map(item => (
                <QueueReviewCard
                  key={item._id}
                  item={item}
                  onAccept={acceptReview}
                  onRevert={revertReview}
                  isSubmitting={isReviewActing}
                />
              ))
            ) : (
              <EmptyState height={80} message={t('Tất cả yêu cầu thay đổi từ chủ nhà đã được xử lý xong.')} />
            )}
          </View>

          {/* KHỐI 5: Đề xuất độ ẩm & gió tự động */}
          <View onLayout={e => handleSectionLayout('proposals', e)} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <SlidersHorizontal size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Đề xuất độ ẩm & gió tự động')}
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: palette.surface }]}>
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {counts.proposals}
                </Text>
              </View>
            </View>

            {sections.proposals.isError ? (
              <EmptyState
                height={80}
                message={t('Không tải được danh sách đề xuất.')}
                actionLabel={t('Thử lại')}
                onAction={() => { void sections.proposals.refetch() }}
              />
            ) : sections.proposals.isLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={160} radius={Radius.lg} />
              </View>
            ) : proposals.length > 0 ? (
              proposals.map(proposal => (
                <QueueProposalCard
                  key={proposal._id}
                  proposal={proposal}
                  onApprove={approveProposal}
                  onReject={rejectProposal}
                  isSubmitting={isProposalActing}
                />
              ))
            ) : (
              <EmptyState height={80} message={t('Không có đề xuất độ ẩm & gió mới từ AI.')} />
            )}
          </View>

          {/* KHỐI 6: Báo cáo vi khí hậu & Kết luận */}
          <View onLayout={e => handleSectionLayout('reports', e)} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <CalendarCheck size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Báo cáo vi khí hậu & kết luận')}
                </Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: palette.surface }]}>
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {counts.reports}
                </Text>
              </View>
            </View>

            {sections.reports.isError ? (
              <EmptyState
                height={80}
                message={t('Không tải được danh sách báo cáo.')}
                actionLabel={t('Thử lại')}
                onAction={() => { void sections.reports.refetch() }}
              />
            ) : sections.reports.isLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={160} radius={Radius.lg} />
              </View>
            ) : reports.length > 0 ? (
              reports.map(report => (
                <QueueReportCard
                  key={report._id}
                  report={report}
                  onSetConclusion={setConclusion}
                  isSubmitting={isReportActing}
                />
              ))
            ) : (
              <EmptyState height={80} message={t('Tất cả báo cáo vi khí hậu đã được hoàn tất kết luận chuyên môn.')} />
            )}
          </View>
        </View>
      </ScrollView>

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
    marginBottom: Spacing.lg,
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
  sectionContainer: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  countBadge: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBox: {
    marginTop: Spacing.xs,
  },
})
