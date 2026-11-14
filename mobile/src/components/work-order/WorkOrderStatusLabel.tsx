import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { WorkOrderStatus } from '@/types'
import { getWorkOrderStatusLabel } from '@/utils/label.utils'

const DOT_SIZE = 8

interface WorkOrderStatusLabelProps {
  status: WorkOrderStatus
}

// Trạng thái Work Order: chấm màu + chữ, màu lấy từ nhóm trạng thái xử lý của theme (cùng web): chờ bắt đầu xanh dương, đang làm
// lime, đang kiểm / chờ duyệt vàng, đã đóng / huỷ xám
export function WorkOrderStatusLabel({ status }: WorkOrderStatusLabelProps) {
  const palette = usePalette()
  const dotColor: Record<WorkOrderStatus, string> = {
    OPEN: palette.statusNew,
    IN_PROGRESS: palette.statusInProgress,
    VERIFYING: palette.statusWait,
    AWAITING_APPROVAL: palette.statusWait,
    CLOSED: palette.statusResolved,
    CANCELLED: palette.statusResolved,
  }

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor[status] }]} />
      <Text variant="small" weight="semiBold" numberOfLines={1}>
        {getWorkOrderStatusLabel(status)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
