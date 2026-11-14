import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { refetchVisibleQueries } from '@/config/queryClient'
import { SealCheckIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useUnreadHealthReports } from '@/hooks/health/useUnreadHealthReports'
import { useMarkNotificationRead } from '@/hooks/notification/useMarkNotificationRead'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatReportPeriod, getReportKindLabel } from '@/utils/healthReport.utils'
import { t } from '@/utils/i18n.utils'
import { RETURN_TO_HOME } from '@/utils/navigation.utils'

// Chiều cao một dòng chữ body — khung xương lúc tải thay đúng chỗ dòng nội dung
const REPORT_LINE_HEIGHT = 20

// Hàng đầu khối: nhãn "BÁO CÁO MỚI", kèm loại kỳ khi chỉ có một báo cáo
function ReportHeader({ kindLabel }: { kindLabel?: string }) {
  const palette = usePalette()

  return (
    <View style={styles.headerRow}>
      <SealCheckIcon size={20} color={palette.reportLabel} />
      <Text variant="label" weight="bold" color={palette.reportLabel} style={styles.headerLabel}>
        {t('BÁO CÁO MỚI')}
      </Text>
      {kindLabel !== undefined && (
        <Text variant="small" color={palette.textSecondary}>
          {kindLabel}
        </Text>
      )}
    </View>
  )
}

// Khối "Báo cáo mới": báo cáo chủ chưa đọc, kèm trích kết luận của chuyên gia nếu có; đã đọc hết thì giữ khung trống
export function NewReportCard() {
  const palette = usePalette()
  const queryClient = useQueryClient()
  const { reports, isLoading, isError } = useUnreadHealthReports()
  const markRead = useMarkNotificationRead()

  // Đang tải: giữ khung và nhãn, dòng nội dung là khung xương
  if (isLoading) {
    return (
      <Card accessibilityLabel={t('Đang tải báo cáo mới')}>
        <ReportHeader />
        <Skeleton
          width="60%"
          height={REPORT_LINE_HEIGHT}
          radius={Radius.sm}
          color={palette.surfaceStrong}
          delayMs={HOME_SKELETON_DELAY_MS.reports}
        />
      </Card>
    )
  }
  // Lỗi tải: báo lỗi và cho thử lại, không giả làm "chưa có báo cáo"
  if (isError) {
    return (
      <Card accessibilityLabel={t('Không tải được báo cáo mới')}>
        <ReportHeader />
        <View style={styles.errorRow}>
          <Text variant="body" color={palette.textSecondary} style={styles.errorText}>
            {t('Không tải được báo cáo mới')}
          </Text>
          <Button variant="link" label={t('Thử lại')} onPress={() => refetchVisibleQueries(queryClient)} />
        </View>
      </Card>
    )
  }
  if (reports.length === 0) {
    return (
      <Card accessibilityLabel={t('Chưa có báo cáo mới')}>
        <ReportHeader />
        <Text variant="body" color={palette.textSecondary}>
          {t('Chưa có báo cáo mới')}
        </Text>
      </Card>
    )
  }

  const isSingle = reports.length === 1
  const [{ report }] = reports
  // Báo cáo theo nhà: tuần (06:00 thứ Hai), tháng (06:00 ngày 1) có thông báo, ngày và theo yêu cầu thì không (BR-33)
  const title = isSingle
    ? t('Báo cáo {period} · {house} đã sẵn sàng', { period: formatReportPeriod(report), house: report.house_name })
    : t('{count} báo cáo mới', { count: reports.length })
  const conclusion = isSingle ? report.expert_conclusion : null

  const openReports = () => {
    for (const item of reports) markRead.mutate(item.notificationId)
    router.navigate({
      pathname: '/(tabs)/analytics',
      params: {
        returnTo: RETURN_TO_HOME,
        tab: 'reports',
        houseId: report.house_id,
        reportId: isSingle ? report._id : '',
      },
    })
  }

  return (
    // Mở tab Báo cáo của Phân tích, đúng nhà và báo cáo; đánh dấu thông báo đã đọc.
    // Báo cáo che các ngày chủ chưa chấm (BR-31, backend) nên không lộ trạng thái
    <Card
      onPress={openReports}
      accessibilityHint={t('Mở báo cáo ở Phân tích')}
      accessibilityLabel={
        conclusion ? t('{title}. Chuyên gia {name}: {text}', { title, name: conclusion.by.full_name, text: conclusion.text }) : title
      }
    >
      <ReportHeader kindLabel={isSingle ? getReportKindLabel(report.kind) : undefined} />

      <Text variant="heading" weight="semiBold">
        {title}
      </Text>

      {/* Có kết luận của chuyên gia thì trích tối đa 2 dòng; chủ trại không tự viết kết luận */}
      {conclusion && (
        <View style={[styles.quoteBox, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>
            {t('Chuyên gia {name}', { name: conclusion.by.full_name })}
          </Text>
          <Text variant="body" color={palette.textSecondary} numberOfLines={2}>
            {`«${conclusion.text}»`}
          </Text>
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLabel: { flex: 1 },
  quoteBox: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  errorText: { flex: 1 },
})
