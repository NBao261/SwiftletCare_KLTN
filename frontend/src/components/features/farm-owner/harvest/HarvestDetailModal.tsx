import { Badge, Button, Modal } from '@/components/ui'
import { formatDate } from '@/lib/helpers'
import { NEST_TYPE_LABEL, HARVEST_STATUS_TONE, HARVEST_STATUS_LABEL } from '@/components/features/farm-owner/harvest/harvest.constants'
import TraceCodeRow from '@/components/features/farm-owner/harvest/TraceCodeRow'
import SnapshotSection from '@/components/features/farm-owner/harvest/SnapshotSection'
import ListingPanel from '@/components/features/farm-owner/harvest/ListingPanel'
import type { HarvestBatch } from '@/types'

interface HarvestDetailModalProps {
  batch: HarvestBatch
  farmId: string
  zoneLabel: string
  onClose: () => void
  onEdit: (batch: HarvestBatch) => void
  onDelete: (batch: HarvestBatch) => void
  onCreateListing: (batch: HarvestBatch) => void
}

/** HarvestDetailModal – chi tiết 1 đợt thu hoạch: truy xuất nguồn gốc (QR), snapshot môi trường/đàn chim, thao tác */
export default function HarvestDetailModal({
  batch, farmId, zoneLabel, onClose, onEdit, onDelete, onCreateListing,
}: HarvestDetailModalProps) {
  return (
    <Modal open onClose={onClose} title="Chi tiết đợt thu hoạch">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-charcoal">{formatDate(batch.harvest_date)}</p>
            <p className="text-sm text-warmGray">
              {zoneLabel} · {batch.nest_count} tổ · {batch.weight_grams}g · {NEST_TYPE_LABEL[batch.nest_type]}
            </p>
          </div>
          <Badge tone={HARVEST_STATUS_TONE[batch.status]}>{HARVEST_STATUS_LABEL[batch.status]}</Badge>
        </div>

        <TraceCodeRow traceCode={batch.trace_code} />
        <SnapshotSection batch={batch} />

        {batch.status === 'LISTED' && batch.listing_id && (
          <ListingPanel farmId={farmId} listingId={batch.listing_id} />
        )}

        {batch.status === 'DRAFT' && (
          <div className="flex flex-wrap gap-2 border-t border-warmGray/10 pt-4">
            <Button variant="secondary" size="sm" onClick={() => onEdit(batch)}>Sửa</Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(batch)}>Xóa</Button>
            <Button variant="accent" size="sm" onClick={() => onCreateListing(batch)}>Đăng bán</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
