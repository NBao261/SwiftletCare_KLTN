import { useState } from 'react'
import { Alert as NativeAlert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { ArrowsLeftRightIcon, DotsThreeVerticalIcon, WarningIcon, XCircleIcon } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatRow } from '@/components/analytics/StatRow'
import { ReasonSheet } from '@/components/common/ReasonSheet'
import { ActionMenuSheet, type MenuAction } from '@/components/farm/ActionMenuSheet'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { AppHeader } from '@/components/layout/AppHeader'
import { ChecklistSection } from '@/components/work-order/ChecklistSection'
import { WorkOrderDoneSheet } from '@/components/work-order/WorkOrderDoneSheet'
import { WorkOrderStatusLabel } from '@/components/work-order/WorkOrderStatusLabel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useApproveWorkOrder } from '@/hooks/work-order/useApproveWorkOrder'
import { useCancelWorkOrder } from '@/hooks/work-order/useCancelWorkOrder'
import { useReassignWorkOrder } from '@/hooks/work-order/useReassignWorkOrder'
import { useReopenWorkOrder } from '@/hooks/work-order/useReopenWorkOrder'
import { useStartWorkOrder } from '@/hooks/work-order/useStartWorkOrder'
import { useWorkOrderDetail } from '@/hooks/work-order/useWorkOrderDetail'
import { useAuthStore } from '@/stores/authStore'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'
import { formatDateTime } from '@/utils/date.utils'
import { getHouseTechnicianNames } from '@/utils/farm.utils'
import {
  getAlertTypeLabel,
  getSiteCauseLabel,
  getWorkOrderOriginLabel,
  getWorkOrderStatusLabel,
} from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getChecklistProgress } from '@/utils/maintenance.utils'
import {
  getOwnerWorkOrderActions,
  getReassignCandidates,
  getWorkOrderAction,
  getWorkOrderMilestones,
  isApprovalUnverified,
} from '@/utils/workOrder.utils'
import { t } from '@/utils/i18n.utils'

const DETAIL_SKELETON_HEIGHT = 240
const PHOTO_SIZE = 96

/** Chi tiết một Work Order (OPS-FR-001…004, ALERT-FR-018): nguồn, nhà, cảnh báo gốc, người được giao, các mốc, nguyên nhân, việc đã
 * làm, ảnh, lịch sử trạng thái; Work Order phòng ngừa có thêm checklist (G-22). Kỹ thuật viên nhà được giao và chủ trại bấm "Bắt đầu"
 * (OPEN) hoặc "Báo đã làm xong" (IN_PROGRESS, phòng ngừa thì khi đủ checklist). Chủ trại duyệt hoặc mở lại phiếu chờ duyệt ở thanh
 * dưới (chưa xác minh bằng dữ liệu thì nhắc kiểm tại nhà, BR-41); giao lại, huỷ ở nút ⋮ */
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
  const approveWorkOrder = useApproveWorkOrder()
  const reopenWorkOrder = useReopenWorkOrder()
  const cancelWorkOrder = useCancelWorkOrder()
  const reassignWorkOrder = useReassignWorkOrder()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isReassignOpen, setReassignOpen] = useState(false)
  // Sheet nhập lý do: mở lại hoặc huỷ; key mới mỗi lần mở để ô nhập trống
  const [reasonSheet, setReasonSheet] = useState<{ kind: 'reopen' | 'cancel'; key: number } | null>(null)
  const workOrder = detailQuery.data ?? null
  const canDecide = canPerform(user, 'decideWorkOrder')
  const farmQuery = useFarmDetail(canDecide && workOrder ? workOrder.farm_id : '')

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
          toast.show(t('Phiếu công việc đã đổi trạng thái, đã tải lại'))
          return
        }
        NativeAlert.alert(
          t('Không bắt đầu được'),
          getSettingsErrorMessage(error, { 403: t('Chỉ kỹ thuật viên được giao nhà này hoặc chủ trại mới làm được') }),
        )
      },
    })
  }

  // Lỗi khi chủ trại quyết định trên phiếu: 409 là phiếu vừa đổi trạng thái (hook đã tải lại)
  const getDecisionErrorMessage = (error: unknown) =>
    getSettingsErrorMessage(error, { 409: t('Phiếu công việc đã đổi trạng thái, đã tải lại') })

  // Duyệt phiếu chờ duyệt: hỏi lại, chưa xác minh bằng dữ liệu thì nhắc kiểm tại nhà trước
  const approve = () => {
    if (!workOrder) return
    NativeAlert.alert(
      t('Duyệt phiếu công việc?'),
      isApprovalUnverified(workOrder)
        ? t('Dữ liệu chưa xác nhận sự cố đã hết. Chỉ duyệt khi bạn đã kiểm tại nhà. Duyệt xong phiếu và cảnh báo gắn kèm được đóng.')
        : t('Duyệt xong phiếu và cảnh báo gắn kèm được đóng.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Duyệt'),
          onPress: () =>
            approveWorkOrder.mutate(workOrder._id, {
              onSuccess: () => toast.show(t('Đã duyệt phiếu công việc')),
              onError: error => NativeAlert.alert(t('Không duyệt được'), getDecisionErrorMessage(error)),
            }),
        },
      ],
    )
  }

  // Gửi lý do mở lại hoặc huỷ
  const submitReason = (reason: string) => {
    if (!workOrder || !reasonSheet) return
    const onSuccess = () => {
      setReasonSheet(null)
      toast.show(reasonSheet.kind === 'reopen' ? t('Đã mở lại phiếu công việc') : t('Đã huỷ phiếu công việc'))
    }
    if (reasonSheet.kind === 'reopen') reopenWorkOrder.mutate({ workOrderId: workOrder._id, note: reason }, { onSuccess })
    else cancelWorkOrder.mutate({ workOrderId: workOrder._id, reason }, { onSuccess })
  }

  // Giao lại cho kỹ thuật viên được chọn
  const reassign = (assigneeId: string) => {
    if (!workOrder) return
    setReassignOpen(false)
    reassignWorkOrder.mutate(
      { workOrderId: workOrder._id, assigneeId },
      {
        onSuccess: () => toast.show(t('Đã giao lại phiếu công việc')),
        onError: error =>
          NativeAlert.alert(
            t('Không giao lại được'),
            getSettingsErrorMessage(error, {
              400: t('Người nhận phải là kỹ thuật viên đang được giao nhà này'),
              409: t('Phiếu công việc đã đổi trạng thái, đã tải lại'),
            }),
          ),
      },
    )
  }

  const renderBody = () => {
    if (!workOrder) {
      if (detailQuery.isLoading) return <Skeleton width="100%" height={DETAIL_SKELETON_HEIGHT} radius={Radius.md} />
      return (
        <EmptyState
          message={t('Không tải được phiếu công việc')}
          actionLabel={t('Thử lại')}
          onAction={() => detailQuery.refetch()}
        />
      )
    }
    const houseName = houseById.get(workOrder.house_id)?.name ?? '_'
    return (
      <>
        {/* Chờ duyệt mà dữ liệu chưa xác nhận phục hồi (BR-41): chủ trại kiểm tại nhà trước khi duyệt */}
        {canDecide && isApprovalUnverified(workOrder) && (
          <Card style={styles.warning}>
            <WarningIcon size={20} color={palette.alert} weight="fill" />
            <Text variant="small" style={styles.flex}>
              {t('Chưa xác minh bằng dữ liệu: kiểm tại nhà trước khi duyệt.')}
            </Text>
          </Card>
        )}
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

        {/* Work Order phòng ngừa (G-22): checklist chép từ kế hoạch bảo trì, ghi từng mục khi đang làm */}
        {workOrder.kind === 'PREVENTIVE' && (workOrder.checklist?.length ?? 0) > 0 && (
          <ChecklistSection
            workOrderId={workOrder._id}
            checklist={workOrder.checklist ?? []}
            isEditable={workOrder.status === 'IN_PROGRESS' && canPerform(user, 'workOnWorkOrder')}
            onMessage={toast.show}
          />
        )}

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

        {workOrder.plan_id && (
          <Button label={t('Xem kế hoạch bảo trì')} variant="secondary" onPress={() => router.push('/maintenance')} />
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
  const ownerActions = workOrder && canDecide ? getOwnerWorkOrderActions(workOrder) : []
  const house = workOrder ? houseById.get(workOrder.house_id) : undefined
  const reassignCandidates =
    house && workOrder
      ? getReassignCandidates(getHouseTechnicianNames(house, farmQuery.data?.data.members ?? []), workOrder.assignee?._id)
      : []
  // Thao tác trong nút ⋮: giao lại (khi nhà còn kỹ thuật viên khác), huỷ phiếu
  const menuActions: MenuAction[] = [
    ...(ownerActions.includes('reassign') && reassignCandidates.length > 0
      ? [
          {
            icon: ArrowsLeftRightIcon,
            label: t('Giao lại'),
            caption: t('Chọn kỹ thuật viên khác của nhà'),
            onPress: () => setReassignOpen(true),
          },
        ]
      : []),
    ...(ownerActions.includes('cancel')
      ? [
          {
            icon: XCircleIcon,
            label: t('Huỷ phiếu'),
            caption: t('Ghi lý do; phiếu đóng lại, không làm nữa'),
            onPress: () => setReasonSheet(current => ({ kind: 'cancel', key: (current?.key ?? 0) + 1 })),
          },
        ]
      : []),
  ]
  const isAwaitingApproval = ownerActions.includes('approve')
  const activeReasonMutation = reasonSheet?.kind === 'reopen' ? reopenWorkOrder : cancelWorkOrder
  // Work Order phòng ngừa chỉ báo xong khi mọi mục checklist đã có kết quả (BR-41, backend 422 nếu thiếu)
  const checklistProgress = getChecklistProgress(workOrder?.checklist)

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      <View key={language} style={styles.screen}>
        <AppHeader
          title={t('Chi tiết phiếu công việc')}
          onBack={goBack}
          right={
            menuActions.length > 0 ? (
              <IconButton icon={DotsThreeVerticalIcon} label={t('Thao tác khác')} onPress={() => setMenuOpen(true)} />
            ) : undefined
          }
        />
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
        {isAwaitingApproval && (
          <View
            style={[styles.actions, styles.actionRow, { backgroundColor: palette.background, borderTopColor: palette.divider }]}
          >
            <Button
              label={t('Mở lại')}
              variant="secondary"
              onPress={() => setReasonSheet(current => ({ kind: 'reopen', key: (current?.key ?? 0) + 1 }))}
              disabled={approveWorkOrder.isPending}
              style={styles.flex}
            />
            <Button label={t('Duyệt')} onPress={approve} loading={approveWorkOrder.isPending} style={styles.flex} />
          </View>
        )}
        {action && (
          <View style={[styles.actions, { backgroundColor: palette.background, borderTopColor: palette.divider }]}>
            {action === 'start' ? (
              <Button label={t('Bắt đầu làm')} onPress={start} loading={startWorkOrder.isPending} />
            ) : (
              <Button
                label={
                  checklistProgress.isComplete
                    ? t('Báo đã làm xong')
                    : t('Ghi đủ checklist để báo xong ({done}/{total})', {
                        done: checklistProgress.done,
                        total: checklistProgress.total,
                      })
                }
                onPress={() => setDoneOpen(true)}
                disabled={!checklistProgress.isComplete}
              />
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
      <ActionMenuSheet
        visible={isMenuOpen}
        title={workOrder?.title ?? ''}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
      <OptionSheet
        visible={isReassignOpen}
        title={t('Giao lại cho')}
        options={reassignCandidates.map(technician => ({
          id: technician.userId,
          label: technician.name,
          caption: technician.isPrimary ? t('Kỹ thuật viên chính') : undefined,
        }))}
        onSelect={reassign}
        onClose={() => setReassignOpen(false)}
      />
      {reasonSheet && (
        <ReasonSheet
          key={reasonSheet.key}
          visible
          title={reasonSheet.kind === 'reopen' ? t('Mở lại phiếu công việc') : t('Huỷ phiếu công việc')}
          description={
            reasonSheet.kind === 'reopen'
              ? t('Ghi điều chưa đạt để kỹ thuật viên làm tiếp; phiếu về trạng thái Đang làm.')
              : t('Ghi lý do huỷ; phiếu đóng lại và không làm nữa.')
          }
          placeholder={reasonSheet.kind === 'reopen' ? t('Ghi chú mở lại') : t('Lý do huỷ')}
          submitLabel={reasonSheet.kind === 'reopen' ? t('Mở lại') : t('Huỷ phiếu')}
          isSubmitting={activeReasonMutation.isPending}
          error={activeReasonMutation.error ? getDecisionErrorMessage(activeReasonMutation.error) : null}
          onSubmit={submitReason}
          onClose={() => setReasonSheet(null)}
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
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
})
