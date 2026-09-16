// Harvest & Marketplace Page (Farm Owner) – MARKET-FR-001..013 (trừ Buyer công khai)
import { useState, FormEvent, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useZoneStore } from '@/store/zoneStore'
import { useFarmZones } from '@/hooks/useFarms'
import { useHarvests, useCreateHarvest, useUpdateHarvest, useDeleteHarvest } from '@/hooks/useHarvests'
import { useCreateListing, useUpdateListing, useListingInquiries, useListingStats } from '@/hooks/useMarketplace'
import { Button, Input, Select, Textarea, Modal, Card, Badge } from '@/components/ui'
import ZonePicker, { type ZonePickerValue } from '@/components/common/ZonePicker'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmModal from '@/components/common/ConfirmModal'
import { IconHarvest } from '@/components/ui/icons'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import type { HarvestBatch, NestType, ListingStatus } from '@/types'
import type { CreateHarvestInput } from '@/services/api/harvests'

const NEST_TYPE_LABEL: Record<NestType, string> = { RAW: 'Yến thô', CLEANED: 'Yến tinh chế', PREMIUM: 'Yến cao cấp' }
const HARVEST_STATUS_TONE = { DRAFT: 'neutral', LISTED: 'positive', ARCHIVED: 'neutral' } as const
const HARVEST_STATUS_LABEL = { DRAFT: 'Chưa đăng bán', LISTED: 'Đang đăng bán', ARCHIVED: 'Lưu trữ' } as const
const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { AVAILABLE: 'Đang bán', SOLD: 'Đã bán hết', HIDDEN: 'Đang ẩn' }

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

function TraceCodeRow({ traceCode }: { traceCode: string }) {
  const push = useToastStore(s => s.push)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/5 px-4 py-2.5">
      <div className="min-w-0">
        <p className="label-caption">Mã truy xuất nguồn gốc</p>
        <p className="truncate font-mono text-sm text-charcoal">{traceCode}</p>
      </div>
      <Button
        variant="secondary" size="sm"
        onClick={() => { void navigator.clipboard.writeText(traceCode); push('Đã sao chép mã truy xuất') }}
      >
        Sao chép
      </Button>
    </div>
  )
}

function SnapshotSection({ batch }: { batch: HarvestBatch }) {
  const { env_snapshot: env, flock_snapshot: flock } = batch
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">Môi trường TB 7 ngày trước thu hoạch</p>
        {env.insufficient_data ? (
          <p className="text-sm text-warmGray">Chưa đủ dữ liệu (zone mới lắp thiết bị gần đây)</p>
        ) : (
          <ul className="space-y-1 text-sm text-charcoal">
            <li>Nhiệt độ: {env.avg_temperature?.toFixed(1) ?? '--'} °C</li>
            <li>Độ ẩm: {env.avg_humidity?.toFixed(1) ?? '--'} %</li>
            <li>NH3: {env.avg_nh3_ppm?.toFixed(1) ?? '--'} ppm</li>
            <li>CO2: {env.avg_co2_ppm?.toFixed(0) ?? '--'} ppm</li>
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">Đàn chim TB 30 ngày</p>
        {flock.avg_return_rate_30d === undefined ? (
          <p className="text-sm text-warmGray">Chưa có dữ liệu (cần module VISION)</p>
        ) : (
          <ul className="space-y-1 text-sm text-charcoal">
            <li>Return rate: {flock.avg_return_rate_30d.toFixed(1)}%</li>
            <li>Số lượng ước tính: {flock.estimated_population ?? '--'}</li>
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Khối "Tin đăng" cho batch đã LISTED ─────────────────────────────────────

function ListingPanel({ farmId, listingId }: { farmId: string; listingId: string }) {
  const { data: stats, isLoading: loadingStats } = useListingStats(listingId)
  const { data: inquiries } = useListingInquiries(listingId)
  const updateListing = useUpdateListing(farmId)
  const push = useToastStore(s => s.push)

  return (
    <div className="rounded-xl border border-limeMist bg-limeMist/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-caption">Tin đăng trên chợ yến</p>
        {stats && (
          <Select
            value={stats.listing_status}
            onChange={e => updateListing.mutate(
              { id: listingId, listing_status: e.target.value as ListingStatus },
              { onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error') },
            )}
            className="!w-auto"
          >
            {Object.entries(LISTING_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
      </div>

      {loadingStats ? (
        <LoadingSkeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatBlock label="Lượt xem" value={stats?.view_count ?? 0} />
          <StatBlock label="Lượt liên hệ" value={stats?.inquiry_count ?? 0} />
        </div>
      )}

      {inquiries && inquiries.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-charcoal/10 pt-3">
          <p className="label-caption">Liên hệ gần nhất</p>
          {inquiries.slice(0, 5).map(inquiry => (
            <div key={inquiry._id} className="rounded-lg bg-white/60 px-3 py-2 text-sm">
              <p className="font-semibold text-charcoal">{inquiry.buyer_name} {inquiry.buyer_phone ? `· ${inquiry.buyer_phone}` : ''}</p>
              <p className="text-warmGray">{inquiry.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-warmGray">{label}</p>
      <p className="text-xl font-extrabold text-charcoal">{value}</p>
    </div>
  )
}

// ── Modal tạo đợt thu hoạch ──────────────────────────────────────────────────

function CreateHarvestModal({ open, onClose, farmId }: { open: boolean; onClose: () => void; farmId: string }) {
  const createHarvest = useCreateHarvest(farmId)
  const push = useToastStore(s => s.push)
  const [zone, setZone] = useState<Partial<ZonePickerValue>>({ farmId })
  const [form, setForm] = useState({ harvest_date: '', nest_count: '', weight_grams: '', nest_type: 'RAW' as NestType, imagesText: '' })

  function reset() {
    setZone({ farmId })
    setForm({ harvest_date: '', nest_count: '', weight_grams: '', nest_type: 'RAW', imagesText: '' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!zone.zoneId) return
    const input: CreateHarvestInput = {
      zone_id: zone.zoneId,
      harvest_date: new Date(form.harvest_date).toISOString(),
      nest_count: Number(form.nest_count),
      weight_grams: Number(form.weight_grams),
      nest_type: form.nest_type,
      product_images: form.imagesText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    createHarvest.mutate(input, {
      onSuccess: () => { push('Đã tạo đợt thu hoạch'); reset(); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Tạo thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo đợt thu hoạch">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ZonePicker value={zone} onChange={setZone} />
        <Input
          label="Ngày thu hoạch" type="date" required
          value={form.harvest_date} onChange={e => setForm(f => ({ ...f, harvest_date: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Số tổ" type="number" min={1} required
            value={form.nest_count} onChange={e => setForm(f => ({ ...f, nest_count: e.target.value }))}
          />
          <Input
            label="Trọng lượng (gram)" type="number" min={1} step="0.1" required
            value={form.weight_grams} onChange={e => setForm(f => ({ ...f, weight_grams: e.target.value }))}
          />
        </div>
        <Select label="Loại yến" value={form.nest_type} onChange={e => setForm(f => ({ ...f, nest_type: e.target.value as NestType }))}>
          {Object.entries(NEST_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea
          label="Ảnh sản phẩm (tùy chọn)"
          placeholder={'Dán link ảnh đã host sẵn, mỗi dòng 1 link\nhttps://...'}
          value={form.imagesText} onChange={e => setForm(f => ({ ...f, imagesText: e.target.value }))}
        />
        <Button type="submit" loading={createHarvest.isPending} disabled={!zone.zoneId} className="w-full">
          Tạo
        </Button>
      </form>
    </Modal>
  )
}

function EditHarvestModal({ open, onClose, batch, farmId }: { open: boolean; onClose: () => void; batch: HarvestBatch; farmId: string }) {
  const updateHarvest = useUpdateHarvest(farmId)
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState({
    nest_count: String(batch.nest_count), weight_grams: String(batch.weight_grams),
    nest_type: batch.nest_type, imagesText: batch.product_images.join('\n'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateHarvest.mutate(
      {
        id: batch._id,
        nest_count: Number(form.nest_count),
        weight_grams: Number(form.weight_grams),
        nest_type: form.nest_type,
        product_images: form.imagesText.split('\n').map(s => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => { push('Đã cập nhật'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Sửa đợt thu hoạch">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Số tổ" type="number" min={1} required value={form.nest_count} onChange={e => setForm(f => ({ ...f, nest_count: e.target.value }))} />
          <Input label="Trọng lượng (gram)" type="number" min={1} step="0.1" required value={form.weight_grams} onChange={e => setForm(f => ({ ...f, weight_grams: e.target.value }))} />
        </div>
        <Select label="Loại yến" value={form.nest_type} onChange={e => setForm(f => ({ ...f, nest_type: e.target.value as NestType }))}>
          {Object.entries(NEST_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea label="Ảnh sản phẩm" value={form.imagesText} onChange={e => setForm(f => ({ ...f, imagesText: e.target.value }))} />
        <Button type="submit" loading={updateHarvest.isPending} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}

// ── Modal đăng bán (tạo Nest Listing) ────────────────────────────────────────

function CreateListingModal({ open, onClose, batch, farmId }: { open: boolean; onClose: () => void; batch: HarvestBatch; farmId: string }) {
  const createListing = useCreateListing(farmId)
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState({ title: '', description: '', price_vnd: '', show_phone: true, show_email: false, show_zalo: true })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createListing.mutate(
      {
        harvest_batch_id: batch._id,
        title: form.title,
        description: form.description || undefined,
        price_vnd: form.price_vnd ? Number(form.price_vnd) : undefined,
        contact_info: { show_phone: form.show_phone, show_email: form.show_email, show_zalo: form.show_zalo },
      },
      {
        onSuccess: () => { push('Đã đăng bán'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Đăng bán thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Đăng bán trên chợ yến">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Tiêu đề" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Yến thô nguyên chất Nhà Yến Minh Phát" />
        <Textarea label="Mô tả" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <Input label="Giá tham khảo (VNĐ)" type="number" min={0} value={form.price_vnd} onChange={e => setForm(f => ({ ...f, price_vnd: e.target.value }))} />
        <div>
          <p className="label-caption mb-2">Hiện thông tin liên hệ</p>
          <div className="flex flex-wrap gap-4">
            {(['show_phone', 'show_email', 'show_zalo'] as const).map(key => (
              <label key={key} className="flex items-center gap-2 text-sm text-charcoal">
                <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                {key === 'show_phone' ? 'Điện thoại' : key === 'show_email' ? 'Email' : 'Zalo'}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" loading={createListing.isPending} className="w-full">Đăng bán</Button>
      </form>
    </Modal>
  )
}
