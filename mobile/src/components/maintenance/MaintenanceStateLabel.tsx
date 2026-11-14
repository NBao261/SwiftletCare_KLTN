import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { MaintenancePlanState } from '@/types'
import { getMaintenancePlanStateLabel } from '@/utils/label.utils'

const DOT_SIZE = 8

interface MaintenanceStateLabelProps {
  state: MaintenancePlanState
}

// Trạng thái kế hoạch bảo trì: chấm màu + chữ. Quá hạn cam (việc cần xử lý như một cảnh báo), đến hạn vàng (đang chờ làm), theo
// lịch và đã xoá xám — không dùng lime, lime chỉ cho thiết bị đang bật
export function MaintenanceStateLabel({ state }: MaintenanceStateLabelProps) {
  const palette = usePalette()
  const dotColor: Record<MaintenancePlanState, string> = {
    OVERDUE: palette.alert,
    DUE: palette.statusWait,
    SCHEDULED: palette.statusResolved,
    RETIRED: palette.statusResolved,
  }

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor[state] }]} />
      <Text variant="small" weight="semiBold" numberOfLines={1}>
        {getMaintenancePlanStateLabel(state)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: Radius.full },
})
