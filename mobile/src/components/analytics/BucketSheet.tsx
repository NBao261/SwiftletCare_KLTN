import { StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { MetricLineChart } from '@/components/charts/MetricLineChart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useBirdBuckets } from '@/hooks/analytics/useBirdBuckets'
import { usePalette } from '@/hooks/theme/usePalette'
import { getAxisBounds } from '@/utils/analytics.utils'
import { formatVietnamTime } from '@/utils/date.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Biểu đồ trong sheet thấp hơn biểu đồ của màn để sheet không quá cao
const SHEET_CHART_HEIGHT = 200

interface BucketSheetProps {
  houseId: string
  // Ngày đang xem (YYYY-MM-DD giờ Việt Nam); null là sheet đóng
  date: string | null
  // Các ngày có dữ liệu của khoảng đang xem, để chuyển qua lại
  dates: string[]
  onChangeDate: (date: string) => void
  onClose: () => void
}

// "26/10/2026" từ "2026-10-26"
function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

// Số đếm 5 phút của một ngày (VISION-FR-017): đường chim ra, chim về; khung không có chim backend không trả nên không có điểm
export function BucketSheet({ houseId, date, dates, onChangeDate, onClose }: BucketSheetProps) {
  const palette = usePalette()
  const bucketsQuery = useBirdBuckets(houseId, date)
  const buckets = bucketsQuery.data ?? []
  const index = date ? dates.indexOf(date) : -1
  const exits = buckets.map(bucket => bucket.exit_count)
  const entries = buckets.map(bucket => bucket.entry_count)
  const totalExit = exits.reduce((total, value) => total + value, 0)
  const totalEntry = entries.reduce((total, value) => total + value, 0)

  return (
    <BottomSheet visible={date !== null} onClose={onClose}>
      <View style={styles.header}>
        <IconButton
          icon={CaretLeftIcon}
          label={t('Ngày trước')}
          onPress={index > 0 ? () => onChangeDate(dates[index - 1]) : undefined}
        />
        <Text variant="heading" center style={styles.flex}>
          {date ? formatDayLabel(date) : ''}
        </Text>
        <IconButton
          icon={CaretRightIcon}
          label={t('Ngày sau')}
          onPress={index >= 0 && index < dates.length - 1 ? () => onChangeDate(dates[index + 1]) : undefined}
        />
      </View>
      <ChartFrame
        title={t('Số đếm 5 phút')}
        summary={t('Ngày {date}: {exit} chim ra, {entry} chim về', {
          date: date ? formatDayLabel(date) : '',
          exit: formatDecimal(totalExit),
          entry: formatDecimal(totalEntry),
        })}
        height={SHEET_CHART_HEIGHT}
        isLoading={bucketsQuery.isLoading}
        isError={bucketsQuery.isError}
        isEmpty={buckets.length === 0}
        emptyMessage={t('Ngày này chưa có số đếm 5 phút')}
        onRetry={() => bucketsQuery.refetch()}
        legend={[
          { label: t('Ra'), color: palette.houseHealthy },
          { label: t('Về'), color: palette.text },
        ]}
      >
        {width => (
          <MetricLineChart
            width={width}
            height={SHEET_CHART_HEIGHT}
            times={buckets.map(bucket => bucket.bucket_start)}
            formatTime={formatVietnamTime}
            series={[
              { key: 'exit', label: t('Ra'), color: palette.houseHealthy, values: exits },
              { key: 'entry', label: t('Về'), color: palette.text, values: entries },
            ]}
            axis={{ base: 0, top: getAxisBounds([...exits, ...entries], [0]).top }}
            decimals={0}
            unit=""
          />
        )}
      </ChartFrame>
      <Text variant="small" color={palette.textSecondary}>
        {t('Khung 5 phút không có chim ra vào thì không có điểm. Giờ Việt Nam.')}
      </Text>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
})
