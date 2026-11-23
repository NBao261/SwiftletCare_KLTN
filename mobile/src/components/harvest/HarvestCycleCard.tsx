import { StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { RemindExpertButton } from '@/components/common/RemindExpertButton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { HarvestCycle } from '@/types'
import { formatDate } from '@/utils/date.utils'
import { formatCycleComparison } from '@/utils/harvest.utils'
import { getHarvestCycleStatusLabel, getRoleLabel } from '@/utils/label.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const GRAMS_PER_KILOGRAM = 1000
const KILOGRAM_DIGITS = 1

interface HarvestCycleCardProps {
  cycle: HarvestCycle
  // Tên zone của chu kỳ (tra từ danh sách zone của nhà); không tìm thấy thì "_"
  zoneName: string
  hasDivider: boolean
  // Farm Owner trên farm có chuyên gia nhắc chuyên gia kết luận mùa đã đóng (BR-22 nhóm C)
  canRemindExpert?: boolean
}

// Phần trăm hoặc "_" khi chưa có số
function formatOptionalPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '_' : formatPercentValue(value, 0)
}

// Một chu kỳ thu của một zone (HARVEST-FR-007, BR-43): kỳ, sản lượng lần thu đóng kỳ, so với kỳ trước và cùng kỳ năm trước, sức
// khỏe của kỳ (% ngày Tốt, tỷ lệ về tổ, % thời gian trong ngưỡng), độ đầy đủ và kết luận mùa vụ (chỉ đọc — chuyên gia viết ở web)
export function HarvestCycleCard({ cycle, zoneName, hasDivider, canRemindExpert = false }: HarvestCycleCardProps) {
  const palette = usePalette()
  const period = `${formatDate(cycle.start_date)} – ${cycle.end_date ? formatDate(cycle.end_date) : t('nay')}`
  const closing = cycle.closing_harvest
  const yieldText = closing
    ? t('{nests} tổ · {kilograms} kg', {
        nests: formatDecimal(closing.nest_count),
        kilograms: formatDecimal(closing.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS),
      })
    : '_'

  return (
    <View style={[styles.cycle, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}>
      <View style={styles.header}>
        <Text variant="body" weight="semiBold" style={styles.flex} numberOfLines={1}>
          {zoneName}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary}>
          {getHarvestCycleStatusLabel(cycle.status)}
        </Text>
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {period}
      </Text>
      <View>
        <StatRow label={t('Sản lượng lần thu đóng kỳ')} value={yieldText} />
        <StatRow label={t('So với kỳ trước')} value={formatCycleComparison(cycle.comparison?.previous)} />
        <StatRow label={t('So với cùng kỳ năm trước')} value={formatCycleComparison(cycle.comparison?.same_period_last_year)} />
        <StatRow label={t('Ngày Tốt trong kỳ')} value={formatOptionalPercent(cycle.health?.good_days_pct)} />
        <StatRow label={t('Tỷ lệ về tổ trung bình')} value={formatOptionalPercent(cycle.health?.return_rate_avg)} />
        <StatRow label={t('Thời gian trong ngưỡng')} value={formatOptionalPercent(cycle.health?.time_in_range_pct)} />
        <StatRow
          label={t('Số ngày được đánh giá')}
          value={formatOptionalPercent(cycle.completeness_pct)}
          isWarning={cycle.incomplete}
        />
      </View>
      {cycle.incomplete && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Dưới 80 % số ngày được đánh giá nên so sánh sức khỏe của kỳ chưa đủ tin cậy.')}
        </Text>
      )}
      {cycle.conclusion && (
        <View style={[styles.conclusion, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold">
            {t('Kết luận mùa vụ ({role})', { role: getRoleLabel(cycle.conclusion.role) })}
          </Text>
          <Text variant="small">{cycle.conclusion.text}</Text>
          {cycle.conclusion.recommendations ? (
            <Text variant="small" color={palette.textSecondary}>
              {t('Khuyến nghị mùa sau: {text}', { text: cycle.conclusion.recommendations })}
            </Text>
          ) : null}
        </View>
      )}
      {/* Mùa đã đóng, chưa có kết luận: chỉ chuyên gia viết, chủ trại nhắc được một lần */}
      {canRemindExpert && cycle.status === 'CLOSED' && !cycle.conclusion && (
        <View style={[styles.conclusion, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Chưa có kết luận mùa vụ')}
          </Text>
          <RemindExpertButton kind="harvest_cycle" id={cycle._id} remindedAt={cycle.expert_reminded_at} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cycle: { gap: Spacing.sm, paddingVertical: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  conclusion: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md },
})
