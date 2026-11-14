import { useState } from 'react'
import { Alert as NativeAlert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatRow } from '@/components/analytics/StatRow'
import { AppHeader } from '@/components/layout/AppHeader'
import { WorkOrderDoneSheet } from '@/components/work-order/WorkOrderDoneSheet'
import { WorkOrderStatusLabel } from '@/components/work-order/WorkOrderStatusLabel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useStartWorkOrder } from '@/hooks/work-order/useStartWorkOrder'
import { useWorkOrderDetail } from '@/hooks/work-order/useWorkOrderDetail'
import { useAuthStore } from '@/stores/authStore'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { formatDateTime } from '@/utils/date.utils'
import {
  getAlertTypeLabel,
  getSiteCauseLabel,
  getWorkOrderOriginLabel,
  getWorkOrderStatusLabel,
} from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getWorkOrderAction, getWorkOrderMilestones } from '@/utils/workOrder.utils'
import { t } from '@/utils/i18n.utils'

const DETAIL_SKELETON_HEIGHT = 240
const PHOTO_SIZE = 96

/** Chi tiết một Work Order (OPS-FR-001…004, ALERT-FR-018): nguồn, nhà, cảnh báo gốc, người được giao, các mốc, nguyên nhân, việc đã
 * làm, ảnh, lịch sử trạng thái. Kỹ thuật viên nhà được giao và chủ trại bấm "Bắt đầu" (OPEN) hoặc "Báo đã làm xong" (IN_PROGRESS);
 * duyệt, mở lại, huỷ, giao lại ở web của chủ trại */
export default function WorkOrderDetailScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const toast = useToastMessage()
  const { workOrderId = '' } = useLocalSearchParams<{ workOrderId?: string }>()
  const user = useAuthStore(state => state.user)
  const detailQuery = useWorkOrderDetail(workOrderId)
  const startWorkOrder = useStartWorkOrder()
  const { houseById } = useZoneDirectory()
  const [isDoneOpen, setDoneOpen] = useState(false)
  const [isRefreshing, setRefreshing] = useState(false)
  const workOrder = detailQuery.data ?? null

  if (!canPerform(user, 'viewWorkOrders')) return <Redirect href="/(tabs)/home" />

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await detailQuery.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const start = () => {
    if (!workOrder) return
    startWorkOrder.mutate(workOrder._id, {
      onSuccess: () => toast.show(t('Đã bắt đầu làm')),
      // Hook đã tải lại Work Order khi gặp 409; ở đây chỉ báo
      onError: error => {
        if (readApiError(error).status === 409) {
          toast.show(t('Work Order đã đổi trạng thái, đã tải lại'))
          return
        }
        NativeAlert.alert(
          t('Không bắt đầu được'),
          getSettingsErrorMessage(error, { 403: t('Chỉ kỹ thuật viên được giao nhà này hoặc chủ trại mới làm được') }),
        )
      },
    })
  }

  const renderBody = () => {
    if (!workOrder) {
      if (detailQuery.isLoading) return <Skeleton width="100%" height={DETAIL_SKELETON_HEIGHT} radius={Radius.md} />
      return (
        <EmptyState
          message={t('Không tải được Work Order')}
          actionLabel={t('Thử lại')}
          onAction={() => detailQuery.refetch()}
        />
      )
    }
    const houseName = houseById.get(workOrder.house_id)?.name ?? '_'
    return (
      <>
        <View style={styles.titleBlock}>
          <WorkOrderStatusLabel status={workOrder.status} />
          <Text variant="title" weight="semiBold">
            {workOrder.title}
          </Text>
          <Text variant="body" color={palette.textSecondary}>
            {getWorkOrderOriginLabel(workOrder.origin)}
          </Text>
        </View>

        <Card>
          <StatRow label={t('Nhà yến')} value={houseName} />
          <StatRow label={t('Người được giao')} value={workOrder.assignee?.full_name ?? t('Chủ trại xử lý')} />
          {workOrder.alert_type && <StatRow label={t('Cảnh báo')} value={getAlertTypeLabel(workOrder.alert_type)} />}
          {getWorkOrderMilestones(workOrder).map(item => (
            <StatRow key={item.label} label={item.label} value={formatDateTime(item.time)} />
          ))}
          {workOrder.escalated_at && (
            <StatRow label={t('Đã báo chủ trại')} value={formatDateTime(workOrder.escalated_at)} isWarning />
          )}
        </Card>

        {workOrder.description ? (
          <Card>
            <Text variant="body">{workOrder.description}</Text>
          </Card>
        ) : null}

        {(workOrder.cause || workOrder.work_note || (workOrder.photo_urls?.length ?? 0) > 0) && (
          <Card style={styles.gap}>
            <Text variant="body" weight="semiBold">
              {t('Kết quả tại chỗ')}
            </Text>
            {workOrder.cause && <StatRow label={t('Nguyên nhân')} value={getSiteCauseLabel(workOrder.cause)} />}
            {workOrder.work_note ? (
              <Text variant="small" color={palette.textSecondary}>
                {workOrder.work_note}
              </Text>
            ) : null}
            {(workOrder.photo_urls?.length ?? 0) > 0 && (
              <View style={styles.photos}>
                {workOrder.photo_urls?.map((url, index) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    style={[styles.photo, { backgroundColor: palette.surfaceStrong }]}
                    contentFit="cover"
                    accessibilityLabel={t('Ảnh {n}', { n: index + 1 })}
                  />
                ))}
              </View>
            )}
          </Card>
        )}

        {(workOrder.history?.length ?? 0) > 0 && (
          <Card style={styles.gap}>
            <Text variant="body" weight="semiBold">
              {t('Lịch sử')}
            </Text>
            {[...(workOrder.history ?? [])].reverse().map((entry, index) => (
              <View
                key={`${entry.at}-${entry.to}`}
                style={[styles.historyRow, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
              >
                <Text variant="small" weight="semiBold">
                  {getWorkOrderStatusLabel(entry.to)}
                </Text>
                <Text variant="small" color={palette.textSecondary}>
                  {entry.by ? formatDateTime(entry.at) : t('{time} · hệ thống', { time: formatDateTime(entry.at) })}
                </Text>
                {entry.note ? (
                  <Text variant="small" color={palette.textSecondary}>
                    {entry.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {workOrder.alert_id && (
          <Button
            label={t('Xem cảnh báo gốc')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/alert/[alertId]', params: { alertId: workOrder.alert_id as string } })}
          />
        )}
      </>
    )
  }

  const action = workOrder && canPerform(user, 'workOnWorkOrder') ? getWorkOrderAction(workOrder.status) : null

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Chi tiết Work Order')} onBack={goBack} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={palette.textSecondary}
              colors={[palette.text]}
            />
          }
        >
          {renderBody()}
        </ScrollView>
        {action && (
          <View style={[styles.actions, { backgroundColor: palette.background, borderTopColor: palette.divider }]}>
            {action === 'start' ? (
              <Button label={t('Bắt đầu làm')} onPress={start} loading={startWorkOrder.isPending} />
            ) : (
              <Button label={t('Báo đã làm xong')} onPress={() => setDoneOpen(true)} />
            )}
          </View>
        )}
      </View>
      {isDoneOpen && (
        <WorkOrderDoneSheet
          workOrder={workOrder}
          onClose={() => setDoneOpen(false)}
          onDone={message => {
            setDoneOpen(false)
            toast.show(message)
          }}
        />
      )}
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.xxl * 2} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  titleBlock: { gap: Spacing.sm, alignItems: 'flex-start' },
  gap: { gap: Spacing.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: Radius.sm },
  historyRow: { gap: Spacing.xs, paddingTop: Spacing.sm },
  actions: { padding: Spacing.lg, borderTopWidth: BorderWidth.hairline },
})
