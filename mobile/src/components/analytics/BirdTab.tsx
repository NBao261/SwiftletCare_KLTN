import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { getISOWeek, parseISO } from 'date-fns'
import { Card } from '@/components/ui/card'
import { BucketSheet } from '@/components/analytics/BucketSheet'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { CorrelationCard } from '@/components/analytics/CorrelationCard'
import { BirdBarChart } from '@/components/charts/BirdBarChart'
import { CHART_HEIGHT, ChartFrame } from '@/components/charts/ChartFrame'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useBirdDaily } from '@/hooks/analytics/useBirdDaily'
import { usePalette } from '@/hooks/theme/usePalette'
import {
  averageReturnRate,
  getRangeDays,
  groupBirdDays,
  type BirdPeriod,
  type BirdPeriodRow,
} from '@/utils/analytics.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

interface BirdTabProps {
  scope: AnalyticsScope
  // Ngày hôm nay giờ Việt Nam (YYYY-MM-DD)
  today: string
}

// Nhãn trục của một kỳ: ngày "26/10", tuần "T44", tháng "10/2026"
function formatPeriodLabel(row: BirdPeriodRow, period: BirdPeriod): string {
  const [year, month, day] = row.startDate.split('-')
  if (period === 'day') return `${day}/${month}`
  if (period === 'month') return `${month}/${year}`
  return t('T{week}', { week: getISOWeek(parseISO(row.startDate)) })
}

// Tab Đàn chim (theo nhà, đặc tả §4): ra/về theo ngày, tuần, tháng kèm tỉ lệ về tổ; chạm một ngày mở số đếm 5 phút;
// tương quan môi trường – tỉ lệ về tổ theo từng tầng
export function BirdTab({ scope, today }: BirdTabProps) {
  const palette = usePalette()
  const houseId = scope.house?._id ?? ''
  const days = getRangeDays(scope.range)
  const dailyQuery = useBirdDaily(houseId, days, today)
  const [bucketDate, setBucketDate] = useState<string | null>(null)
  const currentDays = dailyQuery.data?.current ?? []
  const rows = groupBirdDays(currentDays, scope.birdPeriod)
  const average = averageReturnRate(currentDays)
  const hasIncomplete = rows.some(row => row.isIncomplete)
  const dates = currentDays.map(day => day.date).sort()

  const periodOptions: { id: BirdPeriod; label: string }[] = [
    { id: 'day', label: t('Ngày') },
    { id: 'week', label: t('Tuần') },
    { id: 'month', label: t('Tháng') },
  ]

  return (
    <View style={styles.tab}>
      <Card>
        <ChoiceChips
          options={periodOptions}
          selectedId={scope.birdPeriod}
          onSelect={scope.selectBirdPeriod}
          placement="card"
          accessibilityLabel={t('Gộp theo')}
        />
        <ChartFrame
          title={t('Ra / Về')}
          summary={t('Đàn chim {count} kỳ, tỉ lệ về tổ trung bình {rate}', {
            count: rows.length,
            rate: average === null ? '_' : formatPercentValue(average),
          })}
          isLoading={dailyQuery.isLoading}
          isError={dailyQuery.isError}
          isEmpty={rows.length === 0}
          isFetching={dailyQuery.isFetching && !dailyQuery.isLoading}
          onRetry={() => dailyQuery.refetch()}
          emptyAction={
            scope.range !== '30d' ? { label: t('Xem 30 ngày'), onPress: () => scope.selectRange('30d') } : undefined
          }
          legend={[
            { label: t('Ra'), color: palette.houseHealthy },
            { label: t('Về'), color: palette.text },
            { label: t('Thiếu phiên'), color: palette.textSecondary },
          ]}
        >
          {width => (
            <BirdBarChart
              width={width}
              height={CHART_HEIGHT}
              rows={rows}
              formatLabel={row => formatPeriodLabel(row, scope.birdPeriod)}
              onPressRow={scope.birdPeriod === 'day' ? row => setBucketDate(row.startDate) : undefined}
            />
          )}
        </ChartFrame>
        {scope.birdPeriod === 'day' && rows.length > 0 && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Chạm một ngày để xem số đếm 5 phút.')}
          </Text>
        )}
        {hasIncomplete && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Cột xám: ngày thiếu phiên sáng hoặc chiều, chưa tính tỉ lệ về tổ.')}
          </Text>
        )}
        {/* Backend gộp các lần LOW_RETURN_RATE vào một cảnh báo, chưa tách theo ngày (VISION-FR-011) */}
        <ComingSoonAction label={t('Mốc cảnh báo tỉ lệ về tổ thấp theo ngày')} />
      </Card>

      {scope.zones.length > 0 && <CorrelationCard zones={scope.zones} days={days} />}

      <BucketSheet
        houseId={houseId}
        date={bucketDate}
        dates={dates}
        onChangeDate={setBucketDate}
        onClose={() => setBucketDate(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.md },
})
