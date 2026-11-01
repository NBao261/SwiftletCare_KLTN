import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { AcknowledgeSheet } from '@/components/alert/AcknowledgeSheet'
import { AlertEvidence } from '@/components/alert/AlertEvidence'
import { SeverityLabel } from '@/components/alert/SeverityLabel'
import { VerdictSheet } from '@/components/alert/VerdictSheet'
import { StatRow } from '@/components/analytics/StatRow'
import { ComingSoonAction } from '@/components/common/ComingSoonAction'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { RelayControlSheet } from '@/components/farm/RelayControlSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { getScopeKey, useActiveAlertsOfScopes } from '@/hooks/alert/useActiveAlertsOfScopes'
import { useAlertDetail } from '@/hooks/alert/useAlertDetail'
import { useAlertLocations } from '@/hooks/alert/useAlertLocations'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { Alert, RelayName } from '@/types'
import { describeAlertDetail, getAutoCloseText, isEnvironmentAlert } from '@/utils/alertDetail.utils'
import { isInferredAlert } from '@/utils/alertList.utils'
import { formatDateTime } from '@/utils/date.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { getAlertStatusLabel, getAlertTypeLabel, getRelayLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const RELAYS: RelayName[] = ['misting', 'ventilation', 'speaker']
const DETAIL_SKELETON_HEIGHT = 240

interface AlertDetailContentProps {
  alertId: string
  // Hàng đã có trong danh sách: hiện ngay trong lúc tải bản mới nhất
  initialAlert?: Alert | null
  // Bằng chứng chỉ tải sau khi sheet mở xong
  isReady: boolean
  now: number
  // Trước khi chuyển màn (đi tới tầng): sheet đóng trước
  onLeave?: () => void
  // Thông báo ngắn sau khi xác nhận, phán quyết
  onMessage?: (message: string) => void
}

// Nội dung chi tiết một cảnh báo (đặc tả §3), dùng chung cho sheet ở tab Cảnh báo và route alert/[alertId]:
// phần chung, nội dung riêng theo loại, bằng chứng (loại suy luận), lịch sử xác nhận và phán quyết, nút đáy theo quyền
export function AlertDetailContent({
  alertId,
  initialAlert,
  isReady,
  now,
  onLeave,
  onMessage,
}: AlertDetailContentProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const detailQuery = useAlertDetail(alertId)
  const alert = detailQuery.data ?? initialAlert ?? null
  const { locate } = useAlertLocations()
  const location = alert ? locate(alert) : null
  const houseId = location?.houseId ?? null
  const houseZonesQuery = useHouseZones(houseId ?? '')
  const farmQuery = useFarmDetail(alert?.farm_id ?? '')
  const farm = farmQuery.data?.data ?? null
  const sensorNodesQuery = useSensorNodes()
  // Cảnh báo đang mở của tầng: sheet điều khiển tay dùng để hỏi lại trước khi bật bơm (ENV-FR-016)
  const zoneScopes = alert?.zone_id ? [{ zoneId: alert.zone_id }] : []
  const zoneAlertsQuery = useActiveAlertsOfScopes(zoneScopes)
  const [isAcknowledgeOpen, setAcknowledgeOpen] = useState(false)
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
  const canVerdict = canPerform(user, 'setAlertVerdict') && isInferred
  // BR-22: chủ trại phán quyết khi farm chưa có chuyên gia — backend chưa làm
  const isOwnerWithoutExpert =
    isInferred && canPerform(user, 'acknowledgeAlert') && farm !== null && !farmHasExpert(farm)
  const controllers = (sensorNodesQuery.data?.data ?? []).filter(node => node.zone_id === alert.zone_id)
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
      router.navigate({ pathname: '/(tabs)/analytics', params: { houseId, tab: 'birds' } })
      return
    }
    router.navigate({ pathname: '/(tabs)/farms/[houseId]', params: { houseId, zoneId: alert.zone_id ?? '' } })
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
        </Card>

        <Card>
          <Text variant="body">{alert.message}</Text>
          {detailLines.map(line => (
            <Text key={line} variant="small" color={palette.textSecondary}>
              {line}
            </Text>
          ))}
        </Card>

        {isInferred && (
          <Card>
            <AlertEvidence
              alert={alert}
              houseId={houseId}
              houseZones={houseZonesQuery.data ?? []}
              enabled={isReady}
              now={now}
            />
          </Card>
        )}

        <Card>
          <Text variant="body" weight="semiBold">
            {t('Lịch sử')}
          </Text>
          <StatRow label={t('Tạo')} value={formatDateTime(alert.created_at)} />
          {alert.acknowledged_at && (
            <StatRow
              label={t('Xác nhận')}
              value={`${formatDateTime(alert.acknowledged_at)} · ${memberName(alert.acknowledged_by) ?? t('Chủ trại')}`}
            />
          )}
          {alert.acknowledgement_note ? (
            <Text variant="small" color={palette.textSecondary}>
              {t('Ghi chú: {note}', { note: alert.acknowledgement_note })}
            </Text>
          ) : null}
          {alert.renotified_at && <StatRow label={t('Đã nhắc lại')} value={formatDateTime(alert.renotified_at)} />}
          {isInferred && (
            <StatRow
              label={t('Phán quyết')}
              value={
                verdict
                  ? `${verdict.result === 'CONFIRMED' ? t('Đúng') : t('Bác bỏ')} · ${memberName(verdict.by) ?? t('Chuyên gia')} · ${formatDateTime(verdict.at)}`
                  : t('Chờ phán quyết')
              }
              isWarning={!verdict}
            />
          )}
          {verdict?.note ? (
            <Text variant="small" color={palette.textSecondary}>
              {t('Ghi chú phán quyết: {note}', { note: verdict.note })}
            </Text>
          ) : null}
          {/* Bác bỏ chưa chuyển cảnh báo sang "Bị bác bỏ" (DISMISSED) — backend chưa làm */}
          {verdict?.result === 'REJECTED' && <ComingSoonAction label={t('Chuyển sang "Bị bác bỏ"')} />}
        </Card>
      </ScrollView>

      <View style={[styles.actions, { backgroundColor: palette.background, borderTopColor: palette.divider }]}>
        {houseId && (
          <Button
            label={alert.type === 'LOW_RETURN_RATE' ? t('Xem đàn chim') : t('Đi tới tầng')}
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
        {isOwnerWithoutExpert && <ComingSoonAction label={t('Phán quyết (farm chưa có chuyên gia)')} />}
      </View>

      <AcknowledgeSheet
        alert={isAcknowledgeOpen ? alert : null}
        onClose={() => setAcknowledgeOpen(false)}
        onDone={message => {
          setAcknowledgeOpen(false)
          onMessage?.(message)
        }}
      />
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
        zoneAlerts={
          alert.zone_id ? (zoneAlertsQuery.byScopeKey.get(getScopeKey({ zoneId: alert.zone_id }))?.alerts ?? []) : []
        }
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
