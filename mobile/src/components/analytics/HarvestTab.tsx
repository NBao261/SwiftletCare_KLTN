import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { StatRow } from '@/components/analytics/StatRow'
import { CHART_HEIGHT, ChartFrame } from '@/components/charts/ChartFrame'
import { HarvestStackedChart } from '@/components/charts/HarvestStackedChart'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useFarmHarvests } from '@/hooks/harvest/useFarmHarvests'
import { usePalette } from '@/hooks/theme/usePalette'
import { harvestTotalsByPeriod, harvestYears, NEST_TYPES, type HarvestPeriod } from '@/utils/harvest.utils'
import { getNestTypeLabel } from '@/utils/label.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Như web: số kg hiện 2 chữ số lẻ
const KILOGRAM_DIGITS = 2

type HarvestMetric = 'kilograms' | 'nests'

interface HarvestTabProps {
  scope: AnalyticsScope
  // Ngày hôm nay giờ Việt Nam (YYYY-MM-DD)
  today: string
}

// Nhãn cột: tháng "T11", quý "Q4", năm "2026"
function formatBucket(bucket: number, period: HarvestPeriod): string {
  if (period === 'month') return t('T{month}', { month: bucket })
  if (period === 'quarter') return t('Q{quarter}', { quarter: bucket })
  return String(bucket)
}

// Tab Sản lượng (ANALYTICS-FR-004, HARVEST-FR-001): đợt thu của nhà hoặc tầng đang chọn, cột xếp chồng theo loại tổ,
// gộp theo tháng / quý / năm, đổi giữa kg và số tổ — cùng cách tính biểu đồ năm của web
export function HarvestTab({ scope, today }: HarvestTabProps) {
  const palette = usePalette()
  const currentYear = Number(today.slice(0, 4))
  const [period, setPeriod] = useState<HarvestPeriod>('month')
  const [metric, setMetric] = useState<HarvestMetric>('kilograms')
  const [year, setYear] = useState(currentYear)
  const harvestsQuery = useFarmHarvests(scope.farm?._id ?? '')
  const batches = harvestsQuery.data?.data ?? []
  const zoneIds = scope.selectedZoneId ? [scope.selectedZoneId] : scope.zones.map(zone => zone._id)
  const years = harvestYears(batches, zoneIds, currentYear)
  const selectedYear = years.includes(year) ? year : years[0]
  const yearIndex = years.indexOf(selectedYear)
  const totals = harvestTotalsByPeriod(batches, zoneIds, period, selectedYear)
  const valuesByType = metric === 'kilograms' ? totals.kilogramsByType : totals.nestsByType
  const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0)
  const totalKilograms = sumOf(NEST_TYPES.flatMap(type => totals.kilogramsByType[type]))
  const totalNests = sumOf(NEST_TYPES.flatMap(type => totals.nestsByType[type]))
  const totalRuns = sumOf(totals.runs)
  const scopeName = scope.selectedZoneId
    ? (scope.zones.find(zone => zone._id === scope.selectedZoneId)?.name ?? '_')
    : (scope.house?.name ?? '_')
  const kilogramsText = `${formatDecimal(totalKilograms, KILOGRAM_DIGITS)} kg`

  return (
    <View style={styles.tab}>
      <Card>
        <ChoiceChips
          options={[
            { id: 'month', label: t('Tháng') },
            { id: 'quarter', label: t('Quý') },
            { id: 'year', label: t('Năm') },
          ]}
          selectedId={period}
          onSelect={setPeriod}
          placement="card"
          accessibilityLabel={t('Gộp theo')}
        />
        <ChoiceChips
          options={[
            { id: 'kilograms', label: t('Khối lượng (kg)') },
            { id: 'nests', label: t('Số tổ') },
          ]}
          selectedId={metric}
          onSelect={setMetric}
          placement="card"
          accessibilityLabel={t('Đơn vị')}
        />
        {period !== 'year' && (
          <View style={styles.yearRow}>
            <IconButton
              icon={CaretLeftIcon}
              label={t('Năm trước')}
              onPress={yearIndex < years.length - 1 ? () => setYear(years[yearIndex + 1]) : undefined}
            />
            <Text variant="body" weight="semiBold" center style={styles.flex}>
              {t('Năm {year}', { year: selectedYear })}
            </Text>
            <IconButton
              icon={CaretRightIcon}
              label={t('Năm sau')}
              onPress={yearIndex > 0 ? () => setYear(years[yearIndex - 1]) : undefined}
            />
          </View>
        )}
        <ChartFrame
          title={t('Sản lượng · {scope}', { scope: scopeName })}
          summary={t('Sản lượng {scope}: {kilograms}, {nests} tổ, {runs} lần thu', {
            scope: scopeName,
            kilograms: kilogramsText,
            nests: formatDecimal(totalNests),
            runs: totalRuns,
          })}
          isLoading={harvestsQuery.isLoading}
          isError={harvestsQuery.isError}
          isEmpty={totalRuns === 0}
          emptyMessage={
            period === 'year'
              ? t('Chưa có đợt thu nào')
              : t('Chưa có đợt thu nào trong năm {year}', { year: selectedYear })
          }
          onRetry={() => harvestsQuery.refetch()}
          legend={NEST_TYPES.map(type => ({
            label: getNestTypeLabel(type),
            color: { RAW: palette.nestWhite, CLEANED: palette.nestPink, PREMIUM: palette.nestBlood }[type],
          }))}
        >
          {width => (
            <HarvestStackedChart
              width={width}
              height={CHART_HEIGHT}
              labels={totals.buckets.map(bucket => formatBucket(bucket, period))}
              valuesByType={valuesByType}
              decimals={metric === 'kilograms' ? 1 : 0}
            />
          )}
        </ChartFrame>
        {totalRuns > 0 && (
          <View style={styles.stats}>
            <StatRow label={t('Tổng khối lượng')} value={kilogramsText} />
            <StatRow label={t('Tổng số tổ')} value={formatDecimal(totalNests)} />
            <StatRow label={t('Số lần thu')} value={formatDecimal(totalRuns)} />
            {NEST_TYPES.map(type => {
              const kilograms = sumOf(totals.kilogramsByType[type])
              return (
                <StatRow
                  key={type}
                  label={getNestTypeLabel(type)}
                  value={`${formatDecimal(kilograms, KILOGRAM_DIGITS)} kg · ${formatPercentValue(
                    totalKilograms > 0 ? (kilograms / totalKilograms) * 100 : 0,
                  )}`}
                />
              )
            })}
          </View>
        )}
        <Text variant="small" color={palette.textSecondary}>
          {t(
            'Tính từ các đợt thu đã ghi của {scope}; đợt đã xoá không tính. Một lần thu là các loại yến cùng tầng, cùng ngày.',
            {
              scope: scopeName,
            },
          )}
        </Text>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.md },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  stats: { gap: Spacing.sm },
})
