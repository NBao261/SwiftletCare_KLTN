import { StyleSheet, View } from 'react-native'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { HarvestRunPhoto } from '@/components/harvest/HarvestRunPhoto'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatVietnamDateOf } from '@/utils/date.utils'
import type { HarvestRun } from '@/utils/harvest.utils'
import { getNestTypeLabel } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const GRAMS_PER_KILOGRAM = 1000
const KILOGRAM_DIGITS = 2

interface HarvestRunDetailSheetProps {
  run: HarvestRun | null
  houseName: string
  onClose: () => void
}

// Chi tiết một lần thu cho người chỉ xem (chuyên gia, kỹ thuật viên với lần thu không phải của mình): ngày, số của từng loại yến,
// tổng, trạng thái chờ xác nhận và ảnh (HARVEST-FR-001)
export function HarvestRunDetailSheet({ run, houseName, onClose }: HarvestRunDetailSheetProps) {
  const palette = usePalette()
  if (!run) return null
  const harvestIds = run.nestTypes.flatMap(nestType => run.batchByType[nestType]?._id ?? [])

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {t('Lần thu ngày {date}', { date: formatVietnamDateOf(run.harvest_date) })}
        </Text>
        <Text
          variant="small"
          weight="semiBold"
          color={palette.textSecondary}
          style={[styles.overline, styles.scopeLabel]}
          numberOfLines={1}
        >
          {houseName}
        </Text>
      </View>
      <SettingsTable
        columns={[
          { label: t('Loại yến'), flex: 1.2 },
          { label: t('Số tổ'), align: 'right' },
          { label: t('Trọng lượng (g)'), align: 'right' },
        ]}
        rows={run.nestTypes.map(nestType => {
          const batch = run.batchByType[nestType]
          return {
            id: nestType,
            cells: [
              { text: getNestTypeLabel(nestType) },
              { text: batch ? formatDecimal(batch.nest_count) : '_' },
              { text: batch ? formatDecimal(batch.weight_grams) : '_' },
            ],
          }
        })}
      />
      <Text variant="body" weight="semiBold">
        {t('Tổng: {nests} tổ · {kilograms} kg', {
          nests: formatDecimal(run.nest_count),
          kilograms: formatDecimal(run.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS),
        })}
      </Text>
      {run.isPending && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Lần thu chờ chủ trại xác nhận rồi mới tính vào sản lượng.')}
        </Text>
      )}
      <View style={styles.field}>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline}>
          {t('Ảnh lần thu')}
        </Text>
        <HarvestRunPhoto harvestIds={harvestIds} />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1 },
  scopeLabel: { maxWidth: '45%' },
  field: { gap: Spacing.sm },
})
