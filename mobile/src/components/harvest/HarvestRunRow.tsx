import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatVietnamDateOf } from '@/utils/date.utils'
import type { HarvestRun } from '@/utils/harvest.utils'
import { getNestTypeLabel } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const DOT_SIZE = 8
const GRAMS_PER_KILOGRAM = 1000
// Như web: số kg hiện 2 chữ số lẻ
const KILOGRAM_DIGITS = 2

interface HarvestRunRowProps {
  run: HarvestRun
  hasDivider: boolean
  // Mở form sửa (canEditHarvestRun) hoặc chi tiết chỉ xem
  onPress?: () => void
  // Người dùng sửa được lần thu này: gợi ý cho trình đọc màn hình là "Sửa", không thì "Xem"
  canEdit: boolean
}

// Một lần thu trong danh sách: ngày thu, các loại yến, số tổ, tổng kg; còn lô chờ xác nhận thì có nhãn như web ("Chờ xác nhận")
export function HarvestRunRow({ run, hasDivider, onPress, canEdit }: HarvestRunRowProps) {
  const palette = usePalette()
  const dateText = formatVietnamDateOf(run.harvest_date)
  const typesText = run.nestTypes.map(getNestTypeLabel).join(' · ')
  const nestsText = t('{n} tổ', { n: formatDecimal(run.nest_count) })
  const kilogramsText = `${formatDecimal(run.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS)} kg`
  const pendingText = t('Chờ xác nhận')
  const accessibilityLabel = [dateText, typesText, nestsText, kilogramsText, run.isPending ? pendingText : null]
    .filter(Boolean)
    .join(', ')

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onPress ? (canEdit ? t('Sửa lần thu') : t('Xem lần thu')) : undefined}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={1}>
          {dateText}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {`${typesText} · ${nestsText}`}
        </Text>
        {run.isPending && (
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: palette.statusWait }]} />
            <Text variant="small" weight="semiBold" numberOfLines={1}>
              {pendingText}
            </Text>
          </View>
        )}
      </View>
      <Text variant="body" weight="bold">
        {kilogramsText}
      </Text>
      {onPress && <CaretRightIcon size={16} color={palette.textSecondary} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
