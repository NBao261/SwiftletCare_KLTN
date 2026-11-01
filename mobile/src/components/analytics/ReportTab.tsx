import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { ReportMetrics } from '@/components/analytics/ReportMetrics'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useHealthReportPreview } from '@/hooks/analytics/useHealthReportPreview'
import { useHealthReports } from '@/hooks/analytics/useHealthReports'
import { useUpdateConclusion } from '@/hooks/analytics/useUpdateConclusion'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { ZoneHealthReport } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDateTime, formatVietnamDayMonthOf } from '@/utils/date.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const ROW_SKELETON_HEIGHT = 64
const SKELETON_ROWS = 3
// Kết luận tối đa 4000 ký tự (api-spec PUT /health-reports/{id}/conclusion)
const CONCLUSION_MAX_LENGTH = 4000
const CONCLUSION_INPUT_HEIGHT = 160
// Báo cáo khoảng tự chọn: số ngày gần nhất (backend nhận tối đa 30 ngày)
type PreviewDays = '7' | '14' | '30'

interface ReportTabProps {
  scope: AnalyticsScope
}

// "19/10 – 25/10" theo giờ Việt Nam
function formatPeriod(start: string, end: string): string {
  return `${formatVietnamDayMonthOf(start)} – ${formatVietnamDayMonthOf(end)}`
}

// Tổng số cảnh báo của kỳ
function countAlerts(report: ZoneHealthReport): number {
  return Object.values(report.metrics?.alerts_by_type ?? {}).reduce((total, count) => total + (count ?? 0), 0)
}

// Tab Báo cáo (theo tầng, đặc tả §7): báo cáo tuần mở rộng tại chỗ, kết luận của chuyên gia, báo cáo khoảng tự chọn
export function ReportTab({ scope }: ReportTabProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const zone = scope.focusZone
  const zoneId = zone?._id ?? ''
  const reportsQuery = useHealthReports(zoneId, true)
  const updateConclusion = useUpdateConclusion()
  const [expandedId, setExpandedId] = useState<string | null>(scope.reportId ?? null)
  const [editing, setEditing] = useState<{ reportId: string; text: string } | null>(null)
  const [previewDays, setPreviewDays] = useState<PreviewDays | null>(null)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  const previewQuery = useHealthReportPreview(zoneId, isPreviewOpen && previewDays ? Number(previewDays) : null)
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

  if (!zone) return null

  const renderReport = (report: ZoneHealthReport, index: number) => {
    const isExpanded = expandedId === report._id
    const CaretIcon = isExpanded ? CaretUpIcon : CaretDownIcon
    const conclusion = report.expert_conclusion
    return (
      <View
        key={report._id}
        style={index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.border }}
      >
        <Pressable
          onPress={() => setExpandedId(isExpanded ? null : report._id)}
          style={styles.reportHeader}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={t('Báo cáo {period}', { period: formatPeriod(report.period_start, report.period_end) })}
        >
          <View style={styles.flex}>
            <Text variant="body" weight="semiBold">
              {formatPeriod(report.period_start, report.period_end)}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {t('Ẩm trong ngưỡng {value} · {count} cảnh báo', {
                value:
                  report.metrics?.humidity_in_range_pct === null || report.metrics?.humidity_in_range_pct === undefined
                    ? '_'
                    : formatPercentValue(report.metrics.humidity_in_range_pct),
                count: countAlerts(report),
              })}
            </Text>
          </View>
          {conclusion && (
            <View style={[styles.badge, { backgroundColor: palette.houseHealthy }]}>
              <Text variant="small" weight="semiBold" color={palette.onInverse}>
                {t('Có kết luận')}
              </Text>
            </View>
          )}
          <CaretIcon size={16} color={palette.textSecondary} weight="bold" />
        </Pressable>
        {isExpanded && (
          <View style={styles.reportBody}>
            {report.metrics ? (
              <ReportMetrics metrics={report.metrics} />
            ) : (
              <Text variant="small" color={palette.textSecondary}>
                {t('Báo cáo chưa có số liệu')}
              </Text>
            )}
            {/* Farm chưa có chuyên gia thì không có mục kết luận */}
            {(hasExpert || conclusion) && (
              <View style={[styles.conclusion, { backgroundColor: palette.surfaceStrong }]}>
                <Text variant="small" weight="semiBold">
                  {t('Kết luận của chuyên gia')}
                </Text>
                {conclusion ? (
                  <>
                    <Text variant="body">{conclusion.text}</Text>
                    <Text variant="small" color={palette.textSecondary}>
                      {`${conclusion.by.full_name} · ${formatDateTime(conclusion.at)}`}
                    </Text>
                  </>
                ) : (
                  <Text variant="small" color={palette.textSecondary}>
                    {t('Chưa có kết luận')}
                  </Text>
                )}
                {canWrite && (
                  <Button
                    label={conclusion ? t('Sửa kết luận') : t('Viết kết luận')}
                    variant="link"
                    onPress={() => setEditing({ reportId: report._id, text: conclusion?.text ?? '' })}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.tab}>
      {scope.selectedZoneId === null && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang xem {zone} · chọn tầng ở trên để đổi', { zone: zone.name })}
        </Text>
      )}
      <Card>
        <View style={styles.titleRow}>
          <Text variant="body" weight="semiBold" style={styles.flex}>
            {t('Báo cáo tuần')}
          </Text>
          <Button label={t('Tạo báo cáo')} variant="link" onPress={() => setPreviewOpen(true)} />
        </View>
        {reportsQuery.isLoading ? (
          Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} width="100%" height={ROW_SKELETON_HEIGHT} delayMs={index * 75} />
          ))
        ) : reportsQuery.isError ? (
          <Text variant="small" color={palette.textSecondary} onPress={() => reportsQuery.refetch()}>
            {t('Không tải được. Chạm để thử lại')}
          </Text>
        ) : reports.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Tầng chưa có báo cáo tuần')}
          </Text>
        ) : (
          <View>{reports.map(renderReport)}</View>
        )}
        {reportsQuery.hasNextPage && (
          <Button
            label={t('Xem thêm')}
            variant="link"
            loading={reportsQuery.isFetchingNextPage}
            onPress={() => reportsQuery.fetchNextPage()}
          />
        )}
      </Card>

      <BottomSheet visible={isPreviewOpen} onClose={() => setPreviewOpen(false)}>
        <Text variant="heading">{t('Báo cáo khoảng tự chọn')}</Text>
        <ChoiceChips
          options={[
            { id: '7', label: t('7 ngày gần nhất') },
            { id: '14', label: t('14 ngày gần nhất') },
            { id: '30', label: t('30 ngày gần nhất') },
          ]}
          selectedId={previewDays}
          onSelect={setPreviewDays}
          placement="card"
          accessibilityLabel={t('Chọn khoảng báo cáo')}
        />
        {previewDays === null ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Chọn khoảng để xem báo cáo. Báo cáo này chỉ để xem, không lưu vào danh sách.')}
          </Text>
        ) : previewQuery.isLoading ? (
          <Skeleton width="100%" height={ROW_SKELETON_HEIGHT * 3} />
        ) : previewQuery.isError || !previewQuery.data ? (
          <Text variant="small" color={palette.textSecondary} onPress={() => previewQuery.refetch()}>
            {t('Không tải được. Chạm để thử lại')}
          </Text>
        ) : (
          <>
            <Text variant="small" color={palette.textSecondary}>
              {formatPeriod(previewQuery.data.period_start, previewQuery.data.period_end)}
            </Text>
            <ReportMetrics metrics={previewQuery.data.metrics} />
          </>
        )}
      </BottomSheet>

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
  reportBody: { gap: Spacing.md, paddingBottom: Spacing.md },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  conclusion: { borderRadius: Radius.sm, padding: Spacing.md, gap: Spacing.xs },
  input: {
    ...Typography.body,
    height: CONCLUSION_INPUT_HEIGHT,
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
})
