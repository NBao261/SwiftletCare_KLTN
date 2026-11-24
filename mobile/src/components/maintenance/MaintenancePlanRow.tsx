import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { MaintenanceStateLabel } from '@/components/maintenance/MaintenanceStateLabel'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { MaintenancePlan } from '@/types'
import { getMaintenanceEquipmentLabel, getMaintenancePlanStateLabel } from '@/utils/label.utils'
import { describePlanProgress, formatMaintenanceDate } from '@/utils/maintenance.utils'
import { t } from '@/utils/i18n.utils'

interface MaintenancePlanRowProps {
  plan: MaintenancePlan
  houseName: string
  // Mức đã dùng từ bộ đếm của controller trong nhà (getPlanUsage); null khi theo lịch hoặc chưa có số
  usage: { used: number } | null
  hasDivider: boolean
  onPress: () => void
}

// Một dòng kế hoạch bảo trì: thiết bị, nhà, tiến độ (giờ chạy / số lần đóng cắt so với chu kỳ, hoặc hạn kế tiếp), đến hạn từ ngày
// nào, số Work Order phòng ngừa đang mở, trạng thái
export function MaintenancePlanRow({ plan, houseName, usage, hasDivider, onPress }: MaintenancePlanRowProps) {
  const palette = usePalette()
  const equipment = getMaintenanceEquipmentLabel(plan.equipment)
  const details = [
    houseName,
    describePlanProgress(plan, usage),
    plan.due_since ? t('đến hạn từ {date}', { date: formatMaintenanceDate(plan.due_since) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const openCount = plan.open_work_orders?.length ?? 0

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel={`${equipment}, ${getMaintenancePlanStateLabel(plan.state)}, ${details}`}
      accessibilityHint={t('Xem chi tiết kế hoạch bảo trì')}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={1}>
          {equipment}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
          {details}
        </Text>
        <View style={styles.meta}>
          <MaintenanceStateLabel state={plan.state} />
          {openCount > 0 && (
            <Text variant="small" color={palette.textSecondary}>
              {t('{n} phiếu công việc đang mở', { n: openCount })}
            </Text>
          )}
        </View>
      </View>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
})
