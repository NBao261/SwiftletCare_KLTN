// Harvest & Marketplace Page (Farm Owner) – MARKET-FR-001..013 (trừ Buyer công khai)
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarmZones } from '@/hooks/shared/useFarms'
import { useHarvests, useDeleteHarvest } from '@/hooks/farm-owner/useHarvests'
import { Button } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import HarvestStatsCards from '@/components/features/farm-owner/harvest/HarvestStatsCards'
import HarvestTable from '@/components/features/farm-owner/harvest/HarvestTable'
import HarvestYearChart from '@/components/features/farm-owner/harvest/HarvestYearChart'
import ListingsTab from '@/components/features/farm-owner/harvest/ListingsTab'
import HarvestDetailModal from '@/components/features/farm-owner/harvest/HarvestDetailModal'
import CreateHarvestModal from '@/components/features/farm-owner/harvest/CreateHarvestModal'
import EditHarvestModal from '@/components/features/farm-owner/harvest/EditHarvestModal'
import CreateListingModal from '@/components/features/farm-owner/harvest/CreateListingModal'
import { NEST_TYPE_LABEL, HARVEST_STATUS_LABEL } from '@/components/features/farm-owner/harvest/harvest.constants'
import type { HarvestBatch } from '@/types'

const SECTIONS = [
  { id: 'section-harvest', label: 'Đợt thu hoạch' },
  { id: 'section-marketplace', label: 'Tin đăng bán' },
  { id: 'section-analytics', label: 'Biểu đồ & Thống kê' },
] as const

function exportCsv(batches: HarvestBatch[], zoneNameById: Map<string, string>) {
  const header = ['Ngày thu hoạch', 'Khu vực', 'Loại tổ', 'Số tổ', 'Khối lượng (g)', 'Trạng thái']
  const rows = batches.map(b => [
    b.harvest_date.slice(0, 10),
    zoneNameById.get(b.zone_id) ?? '',
    NEST_TYPE_LABEL[b.nest_type],
    String(b.nest_count),
    String(b.weight_grams),
    HARVEST_STATUS_LABEL[b.status],
  ])
  const csv = [header, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `thu-hoach-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FarmOwnerHarvestPage() {
  const { selectedFarmId } = useZoneStore()
  const { data: batches, isLoading } = useHarvests(selectedFarmId ?? undefined)
  const { data: zones } = useFarmZones(selectedFarmId ?? undefined)
  const deleteHarvest = useDeleteHarvest(selectedFarmId ?? undefined)
  const push = useToastStore(s => s.push)

  const [showCreate, setShowCreate] = useState(false)
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null)
  const [editBatchId, setEditBatchId] = useState<string | null>(null)
  const [listingBatchId, setListingBatchId] = useState<string | null>(null)
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null)

  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Scrollspy: section nào nằm giữa màn hình nhiều nhất thì tab tương ứng sáng
  // lên — khớp với hành vi snap-center (lăn chuột dừng ở đâu, section đó tự
  // trượt vào giữa viewport), nên vùng dò cũng lấy dải giữa màn hình (35%-65%)
  // thay vì dải trên cùng.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    SECTIONS.forEach(s => {
      const el = sectionRefs.current[s.id]
      if (el) observer.observe(el)
    })

    // Section cuối (biểu đồ) có thể thấp hơn vùng quan sát 45% phía trên nên
    // IntersectionObserver không bao giờ kích hoạt nó — cuộn chạm đáy khung cuộn
    // (<main> của AppShell) thì ép active luôn section cuối cùng.
    const scrollEl = sectionRefs.current[SECTIONS[0].id]?.closest('main')
    function handleScroll() {
      if (!scrollEl) return
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4) {
        setActiveSection(SECTIONS[SECTIONS.length - 1].id)
      }
    }
    scrollEl?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      scrollEl?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  function scrollToSection(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const zoneNameById = useMemo(
    () => new Map(zones?.map(z => [z._id, `${z.houseName} / ${z.name}`])),
    [zones],
  )

  if (!selectedFarmId) {
    return (
      <EmptyState
        title="Chưa chọn trang trại"
        description="Chọn 1 zone ở thanh trên cùng để xác định trang trại cần quản lý thu hoạch."
        action={
          <Link to="/farms">
            <Button>Đi tới Trang trại</Button>
          </Link>
        }
      />
    )
  }

  if (isLoading) {
    return <LoadingSkeleton count={3} className="h-28 w-full" />
  }

  const allBatches = batches ?? []
  const findBatch = (id: string | null) => (id ? allBatches.find(b => b._id === id) ?? null : null)
  const detailBatch = findBatch(detailBatchId)
  const editBatch = findBatch(editBatchId)
  const listingBatch = findBatch(listingBatchId)

  function handleDelete() {
    if (!deleteBatchId) return
    deleteHarvest.mutate(deleteBatchId, {
      onSuccess: () => { push('Đã xoá đợt thu hoạch'); setDeleteBatchId(null); setDetailBatchId(null) },
      onError: (err) => push(getApiErrorMessage(err, 'Xoá thất bại'), 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">Nhật ký thu hoạch tổ yến</h1>
          <p className="mt-1 text-sm text-warmGray">Theo dõi sản lượng, phân hạng và truy xuất nguồn gốc</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => exportCsv(allBatches, zoneNameById)} disabled={allBatches.length === 0}>
            Xuất dữ liệu
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Ghi đợt thu hoạch</Button>
        </div>
      </div>

      <HarvestStatsCards batches={allBatches} />

      <div className="sticky top-0 z-10 -my-3 flex flex-wrap gap-2 rounded-2xl border border-warmGray/15 bg-white/80 p-[15px] shadow-card backdrop-blur-md">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            aria-current={activeSection === s.id}
            onClick={() => scrollToSection(s.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              activeSection === s.id ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-charcoal hover:bg-warmGray/20',
            )}
          >
            {s.label}
            {s.id === 'section-marketplace' && ` (${allBatches.filter(b => b.status === 'LISTED').length})`}
          </button>
        ))}
      </div>

      <div id="section-harvest" ref={el => { sectionRefs.current['section-harvest'] = el }} className="scroll-mt-16 snap-center">
        <HarvestTable
          batches={allBatches}
          zones={zones}
          zoneNameById={zoneNameById}
          onOpenDetail={batch => setDetailBatchId(batch._id)}
          onEdit={batch => setEditBatchId(batch._id)}
          onDelete={batch => setDeleteBatchId(batch._id)}
          onCreateListing={batch => setListingBatchId(batch._id)}
        />
      </div>

      <div id="section-marketplace" ref={el => { sectionRefs.current['section-marketplace'] = el }} className="scroll-mt-16 snap-center">
        <ListingsTab batches={allBatches} zones={zones} onOpenDetail={batch => setDetailBatchId(batch._id)} />
      </div>

      <div id="section-analytics" ref={el => { sectionRefs.current['section-analytics'] = el }} className="scroll-mt-16 snap-center">
        <HarvestYearChart batches={allBatches} />
      </div>

      <CreateHarvestModal open={showCreate} onClose={() => setShowCreate(false)} farmId={selectedFarmId} />

      {detailBatch && (
        <HarvestDetailModal
          batch={detailBatch}
          farmId={selectedFarmId}
          zoneLabel={zoneNameById.get(detailBatch.zone_id) ?? '—'}
          onClose={() => setDetailBatchId(null)}
          onEdit={batch => { setDetailBatchId(null); setEditBatchId(batch._id) }}
          onDelete={batch => setDeleteBatchId(batch._id)}
          onCreateListing={batch => { setDetailBatchId(null); setListingBatchId(batch._id) }}
        />
      )}

      {editBatch && (
        <EditHarvestModal open onClose={() => setEditBatchId(null)} batch={editBatch} farmId={selectedFarmId} />
      )}

      {listingBatch && (
        <CreateListingModal open onClose={() => setListingBatchId(null)} batch={listingBatch} farmId={selectedFarmId} />
      )}

      <ConfirmModal
        open={!!deleteBatchId}
        title="Xóa đợt thu hoạch?"
        danger
        description="Chỉ xóa được khi chưa đăng bán. Hành động này không thể hoàn tác."
        loading={deleteHarvest.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteBatchId(null)}
      />
    </div>
  )
}
