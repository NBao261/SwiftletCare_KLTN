import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { CustomReportSheet } from '@/components/analytics/CustomReportSheet'
import { HouseReportDetail } from '@/components/analytics/HouseReportDetail'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormMessage } from '@/components/ui/form-message'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { RetryLine } from '@/components/common/RetryLine'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useHealthReports } from '@/hooks/analytics/useHealthReports'
import { useHouseHealthReport } from '@/hooks/analytics/useHouseHealthReport'
import { useUpdateConclusion } from '@/hooks/analytics/useUpdateConclusion'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { HouseHealthReportKind, HouseHealthReportSummary } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { REPORT_KINDS, formatReportPeriod, getReportKindLabel } from '@/utils/healthReport.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const ROW_SKELETON_HEIGHT = 64
const SKELETON_ROWS = 3
const DETAIL_SKELETON_HEIGHT = 160
// Kết luận tối đa 4000 ký tự (api-spec PUT /health-reports/{id}/conclusion)
const CONCLUSION_MAX_LENGTH = 4000
const CONCLUSION_INPUT_HEIGHT = 160
// Mở tab không kèm báo cáo cụ thể thì xem báo cáo tuần
const DEFAULT_KIND: HouseHealthReportKind = 'WEEKLY'

interface ReportTabProps {
  scope: AnalyticsScope
}

// Phần mở rộng của một báo cáo: tải chi tiết khi mở
function ExpandedReport({
  reportId,
  hasExpert,
  onEditConclusion,
}: {
  reportId: string
  hasExpert: boolean
  onEditConclusion?: (reportId: string, text: string) => void
}) {
  const palette = usePalette()
  const reportQuery = useHouseHealthReport(reportId)
  const report = reportQuery.data

  if (reportQuery.isLoading) return <Skeleton width="100%" height={DETAIL_SKELETON_HEIGHT} color={palette.surfaceStrong} />
  if (reportQuery.isError || !report) {
    return <RetryLine message={t('Không tải được báo cáo')} onRetry={() => reportQuery.refetch()} isRetrying={reportQuery.isFetching} />
  }
  return (
    <HouseReportDetail
      report={report}
      hasExpert={hasExpert}
      onEditConclusion={onEditConclusion ? () => onEditConclusion(report._id, report.expert_conclusion?.text ?? '') : undefined}
    />
  )
}

// Tab Báo cáo (EXPERT-FR-005/006): báo cáo theo nhà ngày / tuần / tháng / theo yêu cầu, mở rộng tại chỗ, kết luận của chuyên gia.
// Chỉ xem trên mobile — tải PDF, CSV ở web
export function ReportTab({ scope }: ReportTabProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const house = scope.house
  const houseId = house?._id ?? ''
  // Mở từ thông báo báo cáo (reportId) thì chọn đúng loại kỳ của báo cáo đó
  const openedReport = useHouseHealthReport(scope.reportId ?? null)
  const [pickedKind, setPickedKind] = useState<HouseHealthReportKind | null>(null)
  const kind = pickedKind ?? openedReport.data?.kind ?? DEFAULT_KIND
  const reportsQuery = useHealthReports(houseId, kind, !scope.reportId || !openedReport.isLoading)
  const updateConclusion = useUpdateConclusion()
  const [expandedId, setExpandedId] = useState<string | null>(scope.reportId ?? null)
  const [editing, setEditing] = useState<{ reportId: string; text: string } | null>(null)
  const [isCustomOpen, setCustomOpen] = useState(false)
  const reports = reportsQuery.data?.pages.flatMap(page => page.data) ?? []
  const canWrite = canPerform(user, 'writeConclusion')
  const hasExpert = scope.farm ? farmHasExpert(scope.farm) : false

  const saveConclusion = () => {
    if (!editing) return
    updateConclusion.mutate(
      { reportId: editing.reportId, text: editing.text.trim() },
      { onSuccess: () => setEditing(null) },
    )
  }

  if (!house) return null

  const renderReport = (report: HouseHealthReportSummary, index: number) => {
    const isExpanded = expandedId === report._id
    const CaretIcon = isExpanded ? CaretUpIcon : CaretDownIcon
    const period = formatReportPeriod(report)

    return (
      <View key={report._id} style={index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.border }}>
        <Pressable
          onPress={() => setExpandedId(isExpanded ? null : report._id)}
          style={styles.reportHeader}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={t('Báo cáo {period}', { period })}
        >
          <Text variant="body" weight="semiBold" style={styles.flex}>
            {period}
          </Text>
          {report.has_conclusion && (
            <View style={[styles.badge, { backgroundColor: palette.houseHealthy }]}>
              <Text variant="small" weight="semiBold" color={palette.onInverse}>
                {t('Có kết luận')}
              </Text>
            </View>
          )}
          <CaretIcon size={16} color={palette.textSecondary} weight="bold" />
        </Pressable>
        {isExpanded && (
          <ExpandedReport
            reportId={report._id}
            hasExpert={hasExpert}
            onEditConclusion={canWrite ? (reportId, text) => setEditing({ reportId, text }) : undefined}
          />
        )}
      </View>
    )
  }

  const renderList = () => {
    if (reportsQuery.isLoading || openedReport.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} width="100%" height={ROW_SKELETON_HEIGHT} color={palette.surfaceStrong} delayMs={index * 75} />
      ))
    }
    if (reportsQuery.isError) {
      return (
        <RetryLine message={t('Không tải được báo cáo')} onRetry={() => reportsQuery.refetch()} isRetrying={reportsQuery.isFetching} />
      )
    }
    if (reports.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {kind === 'CUSTOM' ? t('Chưa có báo cáo theo yêu cầu. Bấm "Tạo báo cáo" để tạo.') : t('Nhà chưa có báo cáo loại này')}
        </Text>
      )
    }
    return <View>{reports.map(renderReport)}</View>
  }

  return (
    <View style={styles.tab}>
      <ChoiceChips
        options={REPORT_KINDS.map(item => ({ id: item, label: getReportKindLabel(item) }))}
        selectedId={kind}
        onSelect={setPickedKind}
        accessibilityLabel={t('Chọn loại báo cáo')}
      />
      <Card>
        <View style={styles.titleRow}>
          <Text variant="body" weight="semiBold" style={styles.flex}>
            {t('Báo cáo sức khỏe · {house}', { house: house.name })}
          </Text>
          <Button label={t('Tạo báo cáo')} variant="link" onPress={() => setCustomOpen(true)} />
        </View>
        {renderList()}
        {reportsQuery.hasNextPage && (
          <Button
            label={t('Xem thêm')}
            variant="link"
            loading={reportsQuery.isFetchingNextPage}
            onPress={() => reportsQuery.fetchNextPage()}
          />
        )}
      </Card>
      <Text variant="small" color={palette.textSecondary}>
        {t('Tải PDF, CSV trên bản web.')}
      </Text>

      <CustomReportSheet
        visible={isCustomOpen}
        houseId={house._id}
        onClose={() => setCustomOpen(false)}
        onCreated={report => {
          setCustomOpen(false)
          setPickedKind('CUSTOM')
          setExpandedId(report._id)
        }}
      />

      <BottomSheet visible={editing !== null} onClose={() => setEditing(null)}>
        <Text variant="heading">{t('Kết luận của chuyên gia')}</Text>
        <TextInput
          value={editing?.text ?? ''}
          onChangeText={text => setEditing(current => (current ? { ...current, text } : current))}
          multiline
          maxLength={CONCLUSION_MAX_LENGTH}
          placeholder={t('Kết luận và khuyến nghị cho kỳ này')}
          placeholderTextColor={palette.textSecondary}
          accessibilityLabel={t('Kết luận của chuyên gia')}
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          textAlignVertical="top"
        />
        <FormMessage
          message={
            updateConclusion.error
              ? getSettingsErrorMessage(updateConclusion.error, {
                  403: t('Chỉ chuyên gia đã viết kết luận này mới sửa được'),
                })
              : null
          }
        />
        <Button
          label={t('Lưu kết luận')}
          onPress={saveConclusion}
          disabled={!editing || editing.text.trim() === ''}
          loading={updateConclusion.isPending}
        />
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  input: {
    ...Typography.body,
    height: CONCLUSION_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
