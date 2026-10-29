/**
 * ExpertScadaBanner — Thanh trạng thái SCADA cố định ở đầu mọi trang Chuyên gia
 *
 * 3 trạng thái UX chuẩn nghiệp vụ:
 *  1. Loading  — đang lấy danh sách trang trại từ API
 *  2. Empty    — Chuyên gia chưa được gán trang trại nào (nghiệp vụ SRS AUTH-FR-005)
 *  3. Active   — Có ≥ 1 trang trại → hiện selector + KPI pills
 *
 * Không dùng dữ liệu giả (FALLBACK). Mọi Farm/House/Zone ID luôn là MongoDB ObjectId thật
 * từ API để không bao giờ gây lỗi 422 ở các hook phụ thuộc.
 *
 * SRS v2.1.4: §4.4, EXPERT-FR-001/002/003, ENV-FR-006
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useZoneStore } from '@/stores/zoneStore'
import { useFarms, useHouses, useZones } from '@/hooks/shared/useFarms'
import { useExpertPendingAlerts, useExpertAutonomy } from '@/hooks/domain-expert/useExpertDashboard'
import { useHealthReportList } from '@/hooks/domain-expert/useHealthReports'
import ExpertScadaKpiPills from './ExpertScadaKpiPills'
import ZoneSelectorDropdown from './ZoneSelectorDropdown'
import { BannerSkeleton, BannerEmpty } from './ExpertScadaBannerStates'

interface ExpertScadaBannerProps {
  farmId?: string
  pendingZoneId?: string
}

// ─── Component chính ──────────────────────────────────────────────────────────
export default function ExpertScadaBanner({ farmId, pendingZoneId }: ExpertScadaBannerProps = {}) {
  const { selectedFarmId, selectedFarmName, selectedZoneId, selectedZoneName, setZone } = useZoneStore()

  const [isOpen, setIsOpen] = useState(false)
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null)
  const [activeHouseId, setActiveHouseId] = useState<string | null>(null)
  const [activeHouseName, setActiveHouseName] = useState<string>('')

  const containerRef = useRef<HTMLDivElement>(null)

  // ── 1. Lấy danh sách Farm thật từ API ──────────────────────────────────────
  const { data: farms, isLoading: isLoadingFarms } = useFarms()

  // ── 2. Xác định farmId đang hoạt động — ưu tiên: user vừa chọn → store → farms[0] ──
  const currentFarmId = useMemo(() => {
    if (!farms || farms.length === 0) return undefined
    if (activeFarmId && farms.some(f => f._id === activeFarmId)) return activeFarmId
    if (selectedFarmId && farms.some(f => f._id === selectedFarmId)) return selectedFarmId
    return farms[0]._id
  }, [farms, activeFarmId, selectedFarmId])

  // ── 3. Lấy House và Zone theo farmId / houseId thật ────────────────────────
  const { data: houses } = useHouses(currentFarmId)

  const currentHouseId = useMemo(() => {
    if (!houses || houses.length === 0) return undefined
    if (activeHouseId && houses.some(h => h._id === activeHouseId)) return activeHouseId
    return houses[0]._id
  }, [houses, activeHouseId])

  const { data: zones } = useZones(currentHouseId)

  // ── 4. Đồng bộ store nếu farm/zone đang lưu không thuộc danh sách truy cập ─
  useEffect(() => {
    if (!farms || farms.length === 0 || !currentFarmId) return
    const targetFarm = farms.find(f => f._id === currentFarmId)
    if (!targetFarm) return
    if (!zones || zones.length === 0) return
    const isFarmInStore = selectedFarmId === currentFarmId
    const isZoneInList = Boolean(selectedZoneId && zones.some(z => z._id === selectedZoneId))
    const targetZone = isZoneInList ? zones.find(z => z._id === selectedZoneId)! : zones[0]
    if (!isFarmInStore || !isZoneInList) {
      setZone(targetFarm._id, targetFarm.name, targetZone._id, targetZone.name)
    }
  }, [farms, zones, currentFarmId, selectedFarmId, selectedZoneId, setZone])

  // ── 5. Đóng dropdown khi click ra ngoài, bấm Escape hoặc cuộn trang ───────
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    function handleScroll(e: Event) {
      if (containerRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  // ── KPI pills ──────────────────────────────────────────────────────────────
  const effectiveFarmId = farmId || currentFarmId
  const effectiveZoneId = pendingZoneId || selectedZoneId || zones?.[0]?._id

  const { data: pendingAlerts } = useExpertPendingAlerts(effectiveFarmId, effectiveZoneId)
  const { data: autonomy } = useExpertAutonomy(effectiveZoneId ?? '', '24h')
  const { data: healthReports } = useHealthReportList(effectiveZoneId)

  const pendingCount = pendingAlerts?.length ?? 0
  const autoModePct = autonomy?.auto_mode_pct ?? 0
  const pendingReports = healthReports?.filter(r => !r.expert_conclusion?.text).length ?? 0

  // ── Tên hiển thị trên pill selector ────────────────────────────────────────
  const currentFarm = farms?.find(f => f._id === currentFarmId)
  const displayName = [
    currentFarm?.name ?? selectedFarmName ?? '—',
    activeHouseName || houses?.[0]?.name || '—',
    selectedZoneName ?? zones?.[0]?.name ?? '—',
  ].join(' • ')

  const handleSelectZone = (zoneId: string, zoneName: string) => {
    if (!currentFarmId || !currentFarm) return
    setZone(currentFarmId, currentFarm.name, zoneId, zoneName)
    setIsOpen(false)
  }

  // ── Render theo trạng thái ─────────────────────────────────────────────────
  if (isLoadingFarms) return <BannerSkeleton />
  if (!farms || farms.length === 0) return <BannerEmpty />

  return (
    <div
      ref={containerRef}
      className="relative z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-charcoal px-4 py-3 text-white shadow-card lg:flex-nowrap"
    >
      {/* Vế trái: Chấm xanh trạng thái + Tiêu đề SCADA Chuyên gia */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-white">
          GIÁM SÁT VẬN HÀNH SCADA
        </span>
        <span className="text-warmGray/50">•</span>
        <span className="truncate text-xs font-semibold text-limeMist">
          CHẾ ĐỘ CHUYÊN GIA
        </span>
      </div>

      {/* Giữa: 3 KPI Pills */}
      <ExpertScadaKpiPills
        autoModePct={autoModePct}
        pendingCount={pendingCount}
        pendingReports={pendingReports}
      />

      {/* Vế phải: Nút hình viên thuốc chọn Zone 3 cấp */}
      <ZoneSelectorDropdown
        isOpen={isOpen}
        displayName={displayName}
        farms={farms}
        houses={houses ?? []}
        zones={zones ?? []}
        currentFarmId={currentFarmId ?? ''}
        currentHouseId={currentHouseId ?? ''}
        selectedZoneId={selectedZoneId}
        onToggle={() => setIsOpen(prev => !prev)}
        onSelectFarm={fId => { setActiveFarmId(fId); setActiveHouseId(null); setActiveHouseName('') }}
        onSelectHouse={(hId, hName) => { setActiveHouseId(hId); setActiveHouseName(hName) }}
        onSelectZone={handleSelectZone}
      />
    </div>
  )
}
