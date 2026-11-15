import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { AcknowledgeSheet } from '@/components/alert/AcknowledgeSheet'
import { AlertEvidence } from '@/components/alert/AlertEvidence'
import { AlertTimeline } from '@/components/alert/AlertTimeline'
import { ExpertVerdictCard } from '@/components/alert/ExpertVerdictCard'
import { OnsiteCheckCard } from '@/components/alert/OnsiteCheckCard'
import { OnsiteCheckSheet } from '@/components/alert/OnsiteCheckSheet'
import { SeverityLabel } from '@/components/alert/SeverityLabel'
import { VerdictSheet } from '@/components/alert/VerdictSheet'
import { StatRow } from '@/components/analytics/StatRow'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { RelayControlSheet } from '@/components/farm/RelayControlSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { AlertWorkOrderCard } from '@/components/work-order/AlertWorkOrderCard'
import { BorderWidth, Spacing } from '@/constants/theme'
import { useAlertDetail } from '@/hooks/alert/useAlertDetail'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Alert, RelayName } from '@/types'
import { buildAlertTimeline, describeAlertDetail, getAutoCloseText, isEnvironmentAlert } from '@/utils/alertDetail.utils'
import { isInferredAlert } from '@/utils/alertList.utils'
import { formatDateTime } from '@/utils/date.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { getAlertStatusLabel, getAlertTypeLabel, getRelayLabel, getSiteCauseLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getPendingOnsiteCheck } from '@/utils/workOrder.utils'
import { t } from '@/utils/i18n.utils'

const RELAYS: RelayName[] = ['misting', 'ventilation', 'speaker']
const DETAIL_SKELETON_HEIGHT = 240

interface AlertDetailContentProps {
  alertId: string
  // Hàng đã có trong danh sách: hiện ngay trong lúc tải bản mới nhất
  initialAlert?: Alert | null
  // Bằng chứng chỉ tải sau khi sheet mở xong
  isReady: boolean
  // Trước khi chuyển màn (đi tới tầng): sheet đóng trước
  onLeave?: () => void
  // Thông báo ngắn sau khi xác nhận, phán quyết
  onMessage?: (message: string) => void
  // Màn tầng / phân tích mở từ đây có nút ‹ quay về đây: route chi tiết hoặc tab Cảnh báo (sheet)
  returnTo: string
}

// Nội dung chi tiết một cảnh báo (đặc tả §3), dùng chung cho sheet ở tab Cảnh báo và route alert/[alertId]:
// phần chung, nội dung riêng theo loại, bằng chứng (loại suy luận), lịch sử xác nhận và phán quyết, nút đáy theo quyền
export function AlertDetailContent({
  alertId,
  initialAlert,
  isReady,
  onLeave,
  onMessage,
  returnTo,
}: AlertDetailContentProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const detailQuery = useAlertDetail(alertId)
  const alert = detailQuery.data ?? initialAlert ?? null
  const { locate } = useAlertLocations()
  const location = alert ? locate(alert) : null
  const houseId = location?.houseId ?? null
  const farmQuery = useFarmDetail(alert?.farm_id ?? '')
  const farm = farmQuery.data?.data ?? null
  const sensorNodesQuery = useSensorNodes()
  const [isAcknowledgeOpen, setAcknowledgeOpen] = useState(false)
  const [isOnsiteCheckOpen, setOnsiteCheckOpen] = useState(false)
  const [verdictResult, setVerdictResult] = useState<'CONFIRMED' | 'REJECTED' | null>(null)
  const [isRelayPickerOpen, setRelayPickerOpen] = useState(false)
  const [relaySelection, setRelaySelection] = useState<{ controllerId: string; relay: RelayName } | null>(null)

  if (!alert) {
    if (detailQuery.isLoading) return <Skeleton width="100%" height={DETAIL_SKELETON_HEIGHT} />
    return (
      <EmptyState
        message={t('Không tải được cảnh báo')}
        actionLabel={t('Thử lại')}
        onAction={() => detailQuery.refetch()}
      />
    )
  }

  const memberName = (userId: string | undefined) =>
    farm?.members.find(member => member.user_id === userId)?.full_name ?? null
  const isInferred = isInferredAlert(alert)
  const canAcknowledge = canPerform(user, 'acknowledgeAlert') && alert.status === 'ACTIVE'
  // Yêu cầu kiểm tra tại chỗ còn chờ: chỉ thợ được giao nhà trả lời (EXPERT-FR-021); backend tạo một yêu cầu mỗi cảnh báo suy luận
  const onsiteCheck = alert.onsite_checks?.[0] ?? null
  const canAnswerOnsiteCheck = canPerform(user, 'answerOnsiteCheck') && getPendingOnsiteCheck(alert) !== null
  // Chuyên gia phán quyết; farm chưa có chuyên gia thì chủ trại phán quyết thay (BR-22). Cảnh báo đã hết (RESOLVED) thì
  // không kết luận nữa; bị bác bỏ (DISMISSED) vẫn đổi lại "Đúng" được
  const canVerdict =
    isInferred &&
    alert.status !== 'RESOLVED' &&
    canPerform(user, 'setAlertVerdict', { farmHasExpert: farm ? farmHasExpert(farm) : undefined })
  // Chỉ controller ONLINE mới nhận được lệnh điều khiển tay
  const controllers = (sensorNodesQuery.data?.data ?? []).filter(
    node => node.zone_id === alert.zone_id && node.status === 'ONLINE',
  )
  const canControl = canPerform(user, 'controlRelay') && isEnvironmentAlert(alert) && controllers.length > 0
  const selectedController = controllers.find(node => node._id === relaySelection?.controllerId) ?? null
  const detailLines = describeAlertDetail(alert)
  const occurrences = alert.occurrence_count ?? 1
  const verdict = alert.expert_verdict

  // Đi tới chỗ gây cảnh báo: tỉ lệ về tổ mở Phân tích › Đàn chim, còn lại mở màn Farm đúng nhà, đúng tầng
  const goToSource = () => {
    if (!houseId) return
    onLeave?.()
    if (alert.type === 'LOW_RETURN_RATE') {
      router.navigate({ pathname: '/(tabs)/analytics', params: { houseId, tab: 'birds', returnTo } })
      return
    }
    router.navigate({ pathname: '/(tabs)/farms/[houseId]', params: { houseId, zoneId: alert.zone_id ?? '', returnTo } })
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <SeverityLabel severity={alert.severity} />
          <Text variant="title" weight="semiBold">
            {getAlertTypeLabel(alert.type)}
          </Text>
          <Text variant="body" color={palette.textSecondary}>
            {location?.text ?? '_'}
          </Text>
        </View>

        {/* Kết luận của chuyên gia nổi ở đầu: chủ trại đọc hướng dẫn trước khi xác nhận */}
        {verdict && <ExpertVerdictCard verdict={verdict} />}

        <Card>
          <StatRow label={t('Trạng thái')} value={getAlertStatusLabel(alert.status)} />
          <StatRow label={t('Lần đầu')} value={formatDateTime(alert.created_at)} />
          <StatRow
            label={t('Gần nhất')}
            value={
              occurrences > 1
                ? t('{time} · lặp {count} lần', {
                    time: formatDateTime(alert.last_seen_at ?? alert.created_at),
                    count: occurrences,
                  })
                : formatDateTime(alert.last_seen_at ?? alert.created_at)
            }
          />
          <StatRow label={t('Tự đóng')} value={getAutoCloseText(alert.type)} />
          {alert.resolved_at && <StatRow label={t('Đã đóng lúc')} value={formatDateTime(alert.resolved_at)} />}
          {/* Nguyên nhân tìm thấy tại chỗ, khi xác nhận hoặc khi Work Order làm xong (ALERT-FR-018) */}
          {alert.site_cause && (
            <StatRow label={t('Nguyên nhân tại chỗ')} value={getSiteCauseLabel(alert.site_cause.cause)} />
          )}
          {alert.escalated_at && (
            <StatRow label={t('Đã báo chủ trại')} value={formatDateTime(alert.escalated_at)} isWarning />
          )}
        </Card>

        <Card>
          <Text variant="body">{alert.message}</Text>
          {detailLines.map(line => (
            <Text key={line} variant="small" color={palette.textSecondary}>
              {line}
            </Text>
          ))}
        </Card>

        {isInferred && canPerform(user, 'viewAlertEvidence') && (
          <Card>
            <AlertEvidence alert={alert} enabled={isReady} />
          </Card>
        )}

        {onsiteCheck && <OnsiteCheckCard check={onsiteCheck} />}

        {canPerform(user, 'viewWorkOrders') && (
          <AlertWorkOrderCard
            alertId={alert._id}
            houseName={location?.houseName ?? '_'}
            enabled={isReady}
            onLeave={onLeave}
          />
        )}

        <AlertTimeline
          entries={buildAlertTimeline(alert, memberName)}
          footer={
            isInferred && !verdict ? <StatRow label={t('Phán quyết')} value={t('Chờ phán quyết')} isWarning /> : undefined
          }
        />
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: palette.background, borderTopColor: palette.divider }]}>
        {houseId && (
          <Button
            label={alert.type === 'LOW_RETURN_RATE' ? t('Xem đàn chim') : t('Đi tới khu vực')}
            variant="secondary"
            size="md"
            onPress={goToSource}
            style={styles.action}
          />
        )}
        {canControl && (
          <Button
            label={t('Điều khiển tay')}
            variant="secondary"
            size="md"
            onPress={() => setRelayPickerOpen(true)}
            style={styles.action}
          />
        )}
        {canAnswerOnsiteCheck && (
          <Button
            label={t('Trả lời kiểm tra tại chỗ')}
            size="md"
            onPress={() => setOnsiteCheckOpen(true)}
            style={styles.action}
          />
        )}
        {canAcknowledge && (
          <Button
            label={t('Xác nhận đã biết')}
            size="md"
            onPress={() => setAcknowledgeOpen(true)}
            style={styles.action}
          />
        )}
        {canVerdict && (
          <>
            <Button
              label={t('Bác bỏ')}
              variant="secondary"
              size="md"
              onPress={() => setVerdictResult('REJECTED')}
              style={styles.action}
            />
            <Button
              label={t('Xác nhận đúng')}
              size="md"
              onPress={() => setVerdictResult('CONFIRMED')}
              style={styles.action}
            />
          </>
        )}
      </View>

      {/* Chỉ mount khi mở: mỗi lần mở ghi chú và nguyên nhân bắt đầu trống, không mang lựa chọn cũ sang lần sau */}
      {isAcknowledgeOpen && (
        <AcknowledgeSheet
          alert={alert}
          onClose={() => setAcknowledgeOpen(false)}
          onDone={message => {
            setAcknowledgeOpen(false)
            onMessage?.(message)
          }}
        />
      )}
      {isOnsiteCheckOpen && (
        <OnsiteCheckSheet
          alert={alert}
          onClose={() => setOnsiteCheckOpen(false)}
          onDone={message => {
            setOnsiteCheckOpen(false)
            onMessage?.(message)
          }}
        />
      )}
      <VerdictSheet
        key={verdictResult ?? 'closed'}
        alertId={alert._id}
        result={verdictResult}
        onClose={() => setVerdictResult(null)}
        onDone={() => {
          setVerdictResult(null)
          onMessage?.(t('Đã lưu phán quyết'))
        }}
      />
      <OptionSheet
        visible={isRelayPickerOpen}
        title={t('Điều khiển tay')}
        options={controllers.flatMap(controller =>
          RELAYS.map(relay => ({
            id: `${controller._id}|${relay}`,
            label: getRelayLabel(relay),
            caption: controllers.length > 1 ? controller.device_id : undefined,
          })),
        )}
        onSelect={id => {
          const [controllerId, relay] = id.split('|')
          setRelayPickerOpen(false)
          setRelaySelection({ controllerId, relay: relay as RelayName })
        }}
        onClose={() => setRelayPickerOpen(false)}
      />
      <RelayControlSheet
        key={relaySelection ? `${relaySelection.controllerId}-${relaySelection.relay}` : 'closed'}
        controller={selectedController}
        relay={relaySelection?.relay ?? null}
        onClose={() => setRelaySelection(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  titleBlock: { gap: Spacing.sm, alignItems: 'flex-start' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: BorderWidth.hairline,
  },
  action: { flexGrow: 1 },
})
