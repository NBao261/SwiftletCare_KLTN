import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { StatRow } from '@/components/analytics/StatRow'
import { MaintenanceStateLabel } from '@/components/maintenance/MaintenanceStateLabel'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { MaintenancePlan } from '@/types'
import { formatMaintenanceInterval, getMaintenanceEquipmentLabel } from '@/utils/label.utils'
import { describePlanProgress, formatMaintenanceDate } from '@/utils/maintenance.utils'
import { t } from '@/utils/i18n.utils'

// Cao tối đa phần nội dung để sheet không che hết màn
const BODY_MAX_HEIGHT = 520

interface MaintenancePlanSheetProps {
  plan: MaintenancePlan
  houseName: string
  usage: { used: number } | null
  onClose: () => void
}

// Chi tiết một kế hoạch bảo trì (OPS-FR-005…008), chỉ đọc: chu kỳ, tiến độ, lần làm gần nhất, nguồn chu kỳ, checklist mẫu, lịch sử
// ghi bảo trì / hiệu chuẩn (mỗi Work Order phòng ngừa được duyệt là một lần) và Work Order phòng ngừa đang mở. Sửa kế hoạch và duyệt
// Work Order phòng ngừa là việc của chủ trại trên web
export function MaintenancePlanSheet({ plan, houseName, usage, onClose }: MaintenancePlanSheetProps) {
  const palette = usePalette()
  const records = [...(plan.records ?? [])].sort((first, second) => Date.parse(second.at) - Date.parse(first.at))

  const openWorkOrder = (workOrderId: string) => {
    onClose()
    router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId } })
  }

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{getMaintenanceEquipmentLabel(plan.equipment)}</Text>
        <MaintenanceStateLabel state={plan.state} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View>
          <StatRow label={t('Nhà yến')} value={houseName} />
          <StatRow label={t('Chu kỳ')} value={formatMaintenanceInterval(plan.basis, plan.interval)} />
          <StatRow label={t('Tiến độ')} value={describePlanProgress(plan, usage)} />
          {plan.due_since && (
            <StatRow
              label={t('Đến hạn từ')}
              value={formatMaintenanceDate(plan.due_since)}
              isWarning={plan.state === 'OVERDUE'}
            />
          )}
          <StatRow
            label={t('Lần làm gần nhất')}
            value={plan.last_done_at ? formatMaintenanceDate(plan.last_done_at) : '_'}
          />
          <StatRow label={t('Nguồn chu kỳ')} value={plan.source || '_'} />
        </View>
        {plan.note ? (
          <Text variant="small" color={palette.textSecondary}>
            {plan.note}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text variant="body" weight="semiBold">
            {t('Checklist mẫu')}
          </Text>
          {plan.checklist_template.map((item, index) => (
            <Text key={`${index}-${item}`} variant="small" color={palette.textSecondary}>
              {`${index + 1}. ${item}`}
            </Text>
          ))}
        </View>

        {(plan.open_work_orders?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text variant="body" weight="semiBold">
              {t('Phiếu công việc phòng ngừa đang mở')}
            </Text>
            {plan.open_work_orders?.map((workOrderId, index) => (
              <Button
                key={workOrderId}
                variant="outline"
                size="sm"
                label={t('Mở phiếu công việc {n}', { n: index + 1 })}
                onPress={() => openWorkOrder(workOrderId)}
                style={styles.workOrderButton}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="body" weight="semiBold">
            {t('Lịch sử ghi bảo trì')}
          </Text>
          {records.length === 0 ? (
            <Text variant="small" color={palette.textSecondary}>
              {t('Chưa có lần bảo trì nào được ghi')}
            </Text>
          ) : (
            records.map((record, index) => (
              <View
                key={record.work_order_id}
                style={[styles.record, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
              >
                <Text variant="small" weight="semiBold">
                  {`${record.kind === 'CALIBRATION' ? t('Hiệu chuẩn') : t('Bảo trì')} · ${formatMaintenanceDate(record.at)}`}
                </Text>
                {record.next_due_at ? (
                  <Text variant="small" color={palette.textSecondary}>
                    {t('Hạn kế tiếp {date}', { date: formatMaintenanceDate(record.next_due_at) })}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
        <Text variant="small" color={palette.textSecondary}>
          {t('Chủ trại duyệt phiếu công việc phòng ngừa là một lần ghi bảo trì: bộ đếm về 0 và hạn kế tiếp được tính. Sửa kế hoạch trên web.')}
        </Text>
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  scroll: { maxHeight: BODY_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.lg },
  section: { gap: Spacing.sm },
  workOrderButton: { alignSelf: 'flex-start' },
  record: { gap: Spacing.xs, paddingTop: Spacing.sm },
})
