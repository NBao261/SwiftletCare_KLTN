import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { WorkOrderStatusLabel } from '@/components/work-order/WorkOrderStatusLabel'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { WorkOrder } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { getWorkOrderStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

interface WorkOrderRowProps {
  workOrder: WorkOrder
  // Tên nhà của Work Order (tra từ danh sách nhà); không tìm thấy thì "_"
  houseName: string
  hasDivider: boolean
  onPress: () => void
}

// Một dòng Work Order trong danh sách: tiêu đề, nhà, lúc mở, người được giao, trạng thái
export function WorkOrderRow({ workOrder, houseName, hasDivider, onPress }: WorkOrderRowProps) {
  const palette = usePalette()
  const assigneeName = workOrder.assignee?.full_name ?? t('Chủ trại xử lý')
  const detailText = `${houseName} · ${formatDateTime(workOrder.opened_at)} · ${assigneeName}`

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, hasDivider && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider }]}
      accessibilityRole="button"
      accessibilityLabel={`${workOrder.title}, ${getWorkOrderStatusLabel(workOrder.status)}, ${detailText}`}
      accessibilityHint={t('Xem chi tiết Work Order')}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="semiBold" numberOfLines={2}>
          {workOrder.title}
        </Text>
        <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
          {detailText}
        </Text>
        <WorkOrderStatusLabel status={workOrder.status} />
      </View>
      <CaretRightIcon size={16} color={palette.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
})
