import { useState } from 'react'
import { ArrowRightIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Badge, Button, ConfirmModal, DataTable, type DataTableColumn } from '@/components/ui'
import { ROLLOUT_STATUS, isOpenRollout, rolloutCounts, targetStatus } from '@/components/features/admin/ota/rollout.utils'
import { useFirmwareRolloutAction, useRetryRolloutTarget } from '@/hooks/admin/useFirmwareRollouts'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { formatDateTime } from '@/lib/i18n'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { FirmwareRollout, RolloutAction, RolloutTarget } from '@/types'

const CONFIRM_TEXT: Record<'promote' | 'cancel', { title: string; description: string; label: string }> = {
  promote: {
    title: 'Gửi cho mọi máy ngay?',
    description: 'Các máy còn lại nhận bản cập nhật mà không chờ máy thử xong.',
    label: 'Gửi tất cả',
  },
  cancel: {
    title: 'Huỷ đợt cập nhật?',
    description: 'Máy còn đang chờ sẽ không nhận bản cập nhật. Máy đang tải vẫn cập nhật xong. Không hoàn tác được.',
    label: 'Huỷ đợt',
  },
}

interface Props {
  rollout: FirmwareRollout
  onlineIds: Set<string>
  locationById: Map<string, string>
}

// Một đợt: tiến độ, nút dừng/tiếp tục/gửi tất cả/huỷ và từng bộ điều khiển với trạng thái của nó
export default function RolloutDetail({ rollout, onlineIds, locationById }: Props) {
  const action = useFirmwareRolloutAction()
  const retry = useRetryRolloutTarget()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [confirming, setConfirming] = useState<'promote' | 'cancel' | null>(null)

  const counts = rolloutCounts(rollout)
  const open = isOpenRollout(rollout)
  const canaryCount = rollout.targets.filter(target => target.canary).length
  const percent = counts.total ? Math.round((counts.succeeded / counts.total) * 100) : 0
  const onError = (err: unknown) => push(apiErrorMessage(err, t('Thao tác thất bại')), 'error')

  function run(next: RolloutAction) {
    action.mutate({ id: rollout._id, action: next }, { onSuccess: () => setConfirming(null), onError })
  }

  const columns: DataTableColumn<RolloutTarget>[] = [
    {
      key: 'device', header: 'Thiết bị',
      render: target => (
        <span className="flex flex-wrap items-center gap-2 font-semibold text-charcoal">
          {target.device_id}
          {target.canary && <Badge tone="info">{t('Máy thử')}</Badge>}
        </span>
      ),
    },
    { key: 'location', header: 'Vị trí', render: target => <span className="text-graphite">{locationById.get(target.node_id) ?? '_'}</span> },
    {
      key: 'version', header: 'Firmware',
      render: target => (
        <span className="flex items-center gap-1.5 font-mono">
          {target.from_version}<ArrowRightIcon size={12} aria-hidden className="text-warmGray" />{rollout.version}
        </span>
      ),
    },
    {
      key: 'state', header: 'Trạng thái',
      render: target => {
        const status = targetStatus(target, rollout, onlineIds.has(target.node_id))
        return <Badge tone={status.tone}>{t(status.label)}</Badge>
      },
    },
    {
      key: 'time', header: 'Lúc',
      render: target => {
        const at = target.finished_at ?? target.sent_at
        return <span className="text-graphite">{at ? formatDateTime(at) : '_'}</span>
      },
    },
    {
      key: 'actions', header: '', align: 'right',
      render: target => target.state === 'FAILED' && rollout.status !== 'CANCELLED' && (
        <Button
          variant="secondary"
          size="sm"
          loading={retry.isPending && retry.variables?.nodeId === target.node_id}
          onClick={() => retry.mutate({ id: rollout._id, nodeId: target.node_id }, { onError })}
        >
          {t('Thử lại')}
        </Button>
      ),
    },
  ]

  const confirmText = confirming ? CONFIRM_TEXT[confirming] : null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-h3 font-semibold text-charcoal">
            {t('Firmware {{version}}', { version: rollout.version })}
            <Badge tone={ROLLOUT_STATUS[rollout.status].tone}>{t(ROLLOUT_STATUS[rollout.status].label)}</Badge>
          </p>
          <p className="text-small text-warmGray">
            {t('Tạo lúc {{at}}', { at: formatDateTime(rollout.created_at) })}{rollout.note ? ` · ${rollout.note}` : ''}
          </p>
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            {rollout.stage === 'CANARY' && <Button variant="secondary" size="sm" onClick={() => setConfirming('promote')}>{t('Gửi tất cả ngay')}</Button>}
            {rollout.status === 'ACTIVE'
              ? <Button variant="secondary" size="sm" loading={action.isPending && action.variables?.action === 'pause'} onClick={() => run('pause')}>{t('Tạm dừng')}</Button>
              : <Button size="sm" loading={action.isPending && action.variables?.action === 'resume'} onClick={() => run('resume')}>{t('Tiếp tục')}</Button>}
            <Button variant="secondary" size="sm" onClick={() => setConfirming('cancel')}>{t('Huỷ đợt')}</Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-small text-graphite">
          {t('{{done}}/{{total}} đã cập nhật', { done: counts.succeeded, total: counts.total })}
          {counts.sending > 0 && ` · ${t('{{n}} đang cập nhật', { n: counts.sending })}`}
          {counts.waiting > 0 && ` · ${t('{{n}} đang chờ', { n: counts.waiting })}`}
          {counts.failed > 0 && ` · ${t('{{n}} lỗi', { n: counts.failed })}`}
        </p>
      </div>

      {rollout.paused_reason === 'FAILURE' && rollout.status === 'PAUSED' && (
        <p className="flex items-start gap-2 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
          <WarningCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
          {t('Đợt tự dừng vì có máy cập nhật lỗi. Máy đó đã quay về bản cũ và vẫn chạy bình thường. Kiểm tra máy rồi bấm Thử lại, hoặc Tiếp tục để gửi các máy còn lại.')}
        </p>
      )}
      {rollout.stage === 'CANARY' && rollout.status === 'ACTIVE' && (
        <p className="flex items-start gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-charcoal">
          <InfoIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
          {t('Đang thử trên {{n}} máy. Các máy còn lại nhận bản cập nhật khi máy thử cập nhật xong.', { n: canaryCount })}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rollout.targets}
        getRowKey={target => target.node_id}
        visibleRows={8}
        minTableWidth={640}
        mobileCard={target => {
          const status = targetStatus(target, rollout, onlineIds.has(target.node_id))
          return (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-semibold text-charcoal">{target.device_id}</p>
                <p className="text-small text-warmGray">{locationById.get(target.node_id) ?? '_'} · {target.from_version} → {rollout.version}</p>
                <div><Badge tone={status.tone}>{t(status.label)}</Badge></div>
              </div>
              {columns[columns.length - 1].render(target, 0)}
            </div>
          )
        }}
      />

      <ConfirmModal
        open={confirmText !== null}
        title={confirmText ? t(confirmText.title) : ''}
        description={confirmText?.description}
        confirmLabel={confirmText?.label}
        danger={confirming === 'cancel'}
        loading={action.isPending}
        onConfirm={() => confirming && run(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
