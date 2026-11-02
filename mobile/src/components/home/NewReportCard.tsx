import { StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { SealCheckIcon } from 'phosphor-react-native'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { HOME_SKELETON_DELAY_MS } from '@/constants/homeSkeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useUnreadHealthReports } from '@/hooks/health/useUnreadHealthReports'
import { usePalette } from '@/hooks/theme/usePalette'
import { getIsoWeekNumber } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Chiều cao một dòng chữ body — khung xương lúc tải thay đúng chỗ dòng nội dung
const REPORT_LINE_HEIGHT = 20

// Hàng đầu khối: nhãn "BÁO CÁO MỚI", kèm số tuần khi chỉ có một báo cáo
function ReportHeader({ weekNumber }: { weekNumber?: number }) {
  const palette = usePalette()

  return (
    <View style={styles.headerRow}>
      <SealCheckIcon size={20} color={palette.reportLabel} />
      <Text variant="label" weight="bold" color={palette.reportLabel} style={styles.headerLabel}>
        {t('BÁO CÁO MỚI')}
      </Text>
      {weekNumber !== undefined && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Tuần {week}', { week: weekNumber })}
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
  const { zoneById, houseById } = useZoneDirectory()

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
          <Button variant="link" label={t('Thử lại')} onPress={() => queryClient.refetchQueries({ type: 'active' })} />
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
  // Báo cáo gắn Zone; tên nhà tra qua Zone chứa báo cáo
  const houseId = zoneById.get(report.zone_id)?.house_id
  const houseName = (houseId && houseById.get(houseId)?.name) ?? '_'
  // Báo cáo hiện tại ra theo tuần (06:00 thứ Hai cho tuần trước)
  const weekNumber = getIsoWeekNumber(report.period_start)
  const title = isSingle
    ? t('Báo cáo tuần {week} · {house} đã sẵn sàng', { week: weekNumber, house: houseName })
    : t('{count} báo cáo mới', { count: reports.length })
  const conclusion = isSingle ? report.expert_conclusion : null

  return (
    // shortcut: chưa có màn báo cáo và màn danh sách báo cáo — khi có route thì truyền onPress mở báo cáo và đánh dấu
    // thông báo đã đọc (PUT /notifications/{id}/read); màn báo cáo vẫn phải ẩn trạng thái ngày chủ chưa chấm (BR-31)
    <Card
      accessibilityLabel={
        conclusion ? t('{title}. Chuyên gia {name}: {text}', { title, name: conclusion.by.full_name, text: conclusion.text }) : title
      }
    >
      <ReportHeader weekNumber={isSingle ? weekNumber : undefined} />

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
