// Harvest & Marketplace Page (Farm Owner) – MARKET-FR-001..013 (trừ Buyer công khai)
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useZoneStore } from '@/store/zoneStore'
import { useFarmZones } from '@/hooks/useFarms'
import { useHarvests, useDeleteHarvest } from '@/hooks/useHarvests'
import { Button, Card, Badge } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmModal from '@/components/common/ConfirmModal'
import { IconHarvest } from '@/components/ui/icons'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import { NEST_TYPE_LABEL, HARVEST_STATUS_TONE, HARVEST_STATUS_LABEL } from './constants'
import TraceCodeRow from './components/TraceCodeRow'
import SnapshotSection from './components/SnapshotSection'
import ListingPanel from './components/ListingPanel'
import CreateHarvestModal from './modals/CreateHarvestModal'
import EditHarvestModal from './modals/EditHarvestModal'
import CreateListingModal from './modals/CreateListingModal'
import type { HarvestBatch } from '@/types'

export default function HarvestPage() {
  const { selectedFarmId, selectedFarmName } = useZoneStore()
  const { data: batches, isLoading } = useHarvests(selectedFarmId ?? undefined)
  const { data: zones } = useFarmZones(selectedFarmId ?? undefined)
  const [showCreate, setShowCreate] = useState(false)

  const zoneNameById = useMemo(() => new Map(zones?.map(z => [z._id, `${z.houseName} / ${z.name}`])), [zones])

  if (!selectedFarmId) {
    return (
      <EmptyState
        title="Chưa chọn trang trại"
        description="Chọn 1 zone ở thanh trên cùng để xác định trang trại cần quản lý thu hoạch."
        action={<Link to="/farms"><Button>Đi tới Trang trại</Button></Link>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caption">Trang trại</p>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{selectedFarmName}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Tạo đợt thu hoạch</Button>
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-32 w-full" />}

      {!isLoading && batches?.length === 0 && (
        <EmptyState
          icon={<IconHarvest width={28} height={28} />}
          title="Chưa có đợt thu hoạch nào"
          description="Ghi nhận đợt thu hoạch đầu tiên để hệ thống tự gắn dữ liệu môi trường/đàn chim làm truy xuất nguồn gốc."
          action={<Button onClick={() => setShowCreate(true)}>+ Tạo đợt thu hoạch</Button>}
        />
      )}

      <div className="flex flex-col gap-3">
        {batches?.map(batch => (
          <HarvestCard key={batch._id} batch={batch} farmId={selectedFarmId} zoneLabel={zoneNameById.get(batch.zone_id) ?? '—'} />
        ))}
      </div>

      <CreateHarvestModal open={showCreate} onClose={() => setShowCreate(false)} farmId={selectedFarmId} />
    </div>
  )
}

// ── Thẻ 1 Harvest Batch (accordion) ──────────────────────────────────────────

function HarvestCard({ batch, farmId, zoneLabel }: { batch: HarvestBatch; farmId: string; zoneLabel: string }) {
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showListingCreate, setShowListingCreate] = useState(false)
  const deleteHarvest = useDeleteHarvest(farmId)
  const push = useToastStore(s => s.push)

  function handleDelete() {
    deleteHarvest.mutate(batch._id, {
      onSuccess: () => { push('Đã xoá đợt thu hoạch'); setShowDelete(false) },
      onError: (err) => push(getApiErrorMessage(err, 'Xoá thất bại'), 'error'),
    })
  }

  return (
    <Card>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpanded(v => !v)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-charcoal">{formatDate(batch.harvest_date)}</p>
            <Badge tone={HARVEST_STATUS_TONE[batch.status]}>{HARVEST_STATUS_LABEL[batch.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-warmGray">
            {zoneLabel} · {batch.nest_count} tổ · {batch.weight_grams}g · {NEST_TYPE_LABEL[batch.nest_type]}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-charcoal">{expanded ? 'Thu gọn' : 'Chi tiết'}</span>
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-warmGray/10 pt-4">
          <TraceCodeRow traceCode={batch.trace_code} />
          <SnapshotSection batch={batch} />

          {batch.status === 'DRAFT' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>Sửa</Button>
              <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>Xóa</Button>
              <Button variant="accent" size="sm" onClick={() => setShowListingCreate(true)}>Đăng bán</Button>
            </div>
          )}

          {batch.status === 'LISTED' && batch.listing_id && (
            <ListingPanel farmId={farmId} listingId={batch.listing_id} />
          )}
        </div>
      )}

      <EditHarvestModal open={showEdit} onClose={() => setShowEdit(false)} batch={batch} farmId={farmId} />
      <ConfirmModal
        open={showDelete} title="Xóa đợt thu hoạch?" danger
        description="Chỉ xóa được khi chưa đăng bán. Hành động này không thể hoàn tác."
        loading={deleteHarvest.isPending}
        onConfirm={handleDelete} onCancel={() => setShowDelete(false)}
      />
      <CreateListingModal open={showListingCreate} onClose={() => setShowListingCreate(false)} batch={batch} farmId={farmId} />
    </Card>
  )
}
