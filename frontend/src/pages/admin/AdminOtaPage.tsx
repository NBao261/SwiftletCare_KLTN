// Cập nhật firmware từ xa theo đợt: chọn bản trong kho firmware và các bộ điều khiển; máy offline nhận khi online lại
import { useMemo, useState } from 'react'
import { PlusIcon, UploadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Badge, Button, DataTable, EmptyState, Modal, ModalHeader, SectionCard, type DataTableColumn } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { IconOTA } from '@/components/ui/icons'
import FirmwareUploadForm from '@/components/features/admin/device-stock/FirmwareUploadForm'
import CreateRolloutModal from '@/components/features/admin/ota/CreateRolloutModal'
import RolloutDetail from '@/components/features/admin/ota/RolloutDetail'
import { ROLLOUT_STATUS, isOpenRollout, rolloutCounts } from '@/components/features/admin/ota/rollout.utils'
import { useFirmwareImages } from '@/hooks/admin/useFirmwareImages'
import { useFirmwareRollouts } from '@/hooks/admin/useFirmwareRollouts'
import { useSensorNodes, useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { formatDateTime } from '@/lib/i18n'
import { t } from '@/i18n'
import type { FirmwareRollout } from '@/types'

export default function AdminOtaPage() {
  const { data: rollouts, isLoading, isError, refetch } = useFirmwareRollouts()
  const { data: images } = useFirmwareImages()
  const { data: nodes } = useSensorNodes(undefined, { refetchInterval: 30_000 })
  // Administrator không đọc cấu trúc trang trại: vị trí lấy từ danh sách thiết bị toàn hệ thống
  const { data: systemStatus } = useSystemNodeStatus()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Tải lên xong thì mở luôn đợt cập nhật cho bản đó
  const [newImageId, setNewImageId] = useState<string>()

  const locationById = useMemo(
    () => new Map((systemStatus?.nodes ?? []).map(item => [item._id, [item.farm_name, item.house_name, item.zone_name].filter(Boolean).join(' · ')])),
    [systemStatus],
  )
  const onlineIds = useMemo(() => new Set((nodes ?? []).filter(node => node.status === 'ONLINE').map(node => node._id)), [nodes])

  // Mặc định mở đợt chưa xong mới nhất, không có thì đợt mới nhất
  const list = rollouts ?? []
  const selected = list.find(r => r._id === selectedId) ?? list.find(isOpenRollout) ?? list[0]
  const hasImages = Boolean(images?.length)

  const columns: DataTableColumn<FirmwareRollout>[] = [
    { key: 'version', header: 'Firmware', render: r => <span className="font-semibold text-charcoal">{r.version}</span> },
    { key: 'status', header: 'Trạng thái', render: r => <Badge tone={ROLLOUT_STATUS[r.status].tone}>{t(ROLLOUT_STATUS[r.status].label)}</Badge> },
    {
      key: 'progress', header: 'Tiến độ',
      render: r => {
        const counts = rolloutCounts(r)
        return (
          <span className="text-graphite">
            {t('{{done}}/{{total}} máy', { done: counts.succeeded, total: counts.total })}
            {counts.failed > 0 && <span className="text-alertRed"> · {t('{{n}} lỗi', { n: counts.failed })}</span>}
          </span>
        )
      },
    },
    { key: 'created', header: 'Tạo lúc', render: r => <span className="text-graphite">{formatDateTime(r.created_at)}</span> },
  ]

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setUploading(true)}>
        <UploadSimpleIcon size={14} weight="bold" aria-hidden />{t('Tải bản mới lên')}
      </Button>
      <Button onClick={() => setCreating(true)} disabled={!hasImages || !nodes}>
        <PlusIcon size={14} weight="bold" aria-hidden />{t('Tạo đợt cập nhật')}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        description="Cập nhật firmware từ xa cho bộ điều khiển. Máy mất kết nối nhận bản cập nhật khi kết nối lại."
        help="Mỗi đợt thử trước trên một máy, máy đó cập nhật xong thì mới gửi các máy còn lại. Máy nào không lên được bản mới trong 30 phút thì tự quay về bản cũ, và đợt tự dừng để bạn kiểm tra."
        action={actions}
      >
        {!hasImages && images && (
          <p className="text-sm text-warmGray">{t('Kho chưa có firmware. Bấm Tải bản mới lên để bắt đầu.')}</p>
        )}
        {isLoading && <LoadingSkeleton count={3} className="h-14 w-full" />}
        {isError && (
          <EmptyState
            icon={<WarningCircleIcon size={32} />}
            title="Không tải được các đợt cập nhật"
            description="Kiểm tra kết nối tới máy chủ rồi thử lại."
            action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
          />
        )}
        {rollouts && rollouts.length === 0 && (
          <EmptyState
            icon={<IconOTA width={28} height={28} />}
            title="Chưa có đợt cập nhật nào"
            description="Tạo một đợt để đưa bản firmware mới trong kho tới các bộ điều khiển."
          />
        )}
        {rollouts && rollouts.length > 0 && (
          <DataTable
            columns={columns}
            rows={rollouts}
            getRowKey={r => r._id}
            onRowClick={r => setSelectedId(r._id)}
            visibleRows={5}
            mobileCard={r => (
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-charcoal">{r.version}</p>
                  <p className="text-small text-warmGray">{formatDateTime(r.created_at)}</p>
                </div>
                <Badge tone={ROLLOUT_STATUS[r.status].tone}>{t(ROLLOUT_STATUS[r.status].label)}</Badge>
              </div>
            )}
          />
        )}
      </SectionCard>

      {selected && (
        <SectionCard>
          <RolloutDetail rollout={selected} onlineIds={onlineIds} locationById={locationById} />
        </SectionCard>
      )}

      {images && nodes && (
        <CreateRolloutModal
          open={creating}
          onClose={() => { setCreating(false); setNewImageId(undefined) }}
          onCreated={rollout => { setCreating(false); setNewImageId(undefined); setSelectedId(rollout._id) }}
          initialImageId={newImageId}
          images={images}
          nodes={nodes}
          rollouts={list}
          locationById={locationById}
        />
      )}

      <Modal open={uploading} onClose={() => setUploading(false)} size="lg" ariaLabel={t('Tải bản firmware mới')}>
        <div className="flex flex-col gap-5">
          <ModalHeader
            title={t('Tải bản firmware mới')}
            description="Chọn file factory.bin dựng theo hướng dẫn trong firmware/README.md. Phiên bản được đọc sẵn từ file. Bản này cũng dùng cho trạm nạp USB."
          />
          <FirmwareUploadForm onUploaded={image => { setUploading(false); setNewImageId(image._id); setCreating(true) }} />
        </div>
      </Modal>
    </div>
  )
}
