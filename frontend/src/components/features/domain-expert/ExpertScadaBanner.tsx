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
import { useAlertsWithFilters } from '@/hooks/domain-expert/useExpertAlerts'
import { useExpertAutonomy } from '@/hooks/domain-expert/useExpertDashboard'
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
  const {
    selectedFarmId,
    selectedFarmName,
    selectedZoneId,
    selectedZoneName,
    selectedHouseId,
    setHouse,
    setZone,
  } = useZoneStore()

  const [isOpen, setIsOpen] = useState(false)
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null)
  const [activeHouseId, setActiveHouseId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── 1. Lấy danh sách Farm thật từ API ──────────────────────────────────────
  const { data: farms, isLoading: isLoadingFarms } = useFarms()

  // ── 2. Xác định farmId đang hoạt động ──────────────────────────────────────
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
    if (selectedHouseId && houses.some(h => h._id === selectedHouseId)) return selectedHouseId
    return houses[0]._id
  }, [houses, activeHouseId, selectedHouseId])

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
    if (currentHouseId && selectedHouseId !== currentHouseId) {
      setHouse(currentHouseId)
    }
  }, [farms, zones, currentFarmId, currentHouseId, selectedFarmId, selectedHouseId, selectedZoneId, setZone, setHouse])

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

  // ── 6. KPI pills: Đồng bộ 100% với Backend API & Trang Hàng Đợi Việc ──────
  const effectiveFarmId = farmId || currentFarmId
  const effectiveZoneId = pendingZoneId || selectedZoneId || zones?.[0]?._id

  // Dùng chung hook useAlertsWithFilters để số liệu cảnh báo luôn khớp chính xác với thẻ bên dưới
  const { kpiCounts } = useAlertsWithFilters(effectiveFarmId, effectiveZoneId)
  const { data: autonomy } = useExpertAutonomy(effectiveZoneId ?? '', '24h')
  const { data: healthReports } = useHealthReportList(effectiveZoneId)

  const pendingCount = kpiCounts?.pending ?? 0
  const autoModePct = autonomy?.auto_mode_pct ?? 100
  const pendingReports = healthReports?.filter(r => !r.expert_conclusion?.text).length ?? 0

  // ── Tên hiển thị trên capsule selector ─────────────────────────────────────
  const currentFarm = farms?.find(f => f._id === currentFarmId)
  const currentHouse = houses?.find(h => h._id === currentHouseId)
  const currentZone = zones?.find(z => z._id === selectedZoneId) || zones?.[0]

  const farmName = currentFarm?.name ?? selectedFarmName ?? '—'
  const houseName = currentHouse?.name ?? '—'
  const zoneName = currentZone?.name ?? selectedZoneName ?? '—'
  const displayName = [farmName, houseName, zoneName].join(' • ')

  const handleSelectZone = (zoneId: string, zoneName: string) => {
    if (!currentFarmId || !currentFarm) return
    if (currentHouseId) {
      setHouse(currentHouseId)
    }
    setZone(currentFarmId, currentFarm.name, zoneId, zoneName)
    setIsOpen(false)
  }

  // ── Render theo trạng thái ─────────────────────────────────────────────────
  if (isLoadingFarms) return <BannerSkeleton />
  if (!farms || farms.length === 0) return <BannerEmpty />

  return (
    <div
      ref={containerRef}
      className="relative z-30 w-full rounded-2xl bg-white p-2.5 sm:px-4 sm:py-3 text-charcoal shadow-[0_4px_20px_rgba(39,35,31,0.06)] border border-warmGray/20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 xl:flex-nowrap">
        {/* Vế trái: Badge SCADA LIVE tinh gọn (Màu xanh lá accent của hệ thống) */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-accent-600/30 bg-accent-50 px-2.5 py-1 shadow-sm">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-600" />
            </span>
            <span className="font-mono text-[11px] font-bold tracking-wider text-accent-900">
              SCADA LIVE
            </span>
          </div>

          <span className="text-xs font-bold uppercase tracking-tight text-charcoal sm:text-sm whitespace-nowrap">
            Giám Sát Vận Hành
          </span>
        </div>

        {/* Giữa: 3 KPI Pills telemetry hiển thị dữ liệu thực chất từ API */}
        <ExpertScadaKpiPills
          autoModePct={autoModePct}
          pendingCount={pendingCount}
          pendingReports={pendingReports}
        />

        {/* Vế phải: Nút hình viên thuốc chọn Zone 3 cấp co giãn mượt mà */}
        <ZoneSelectorDropdown
          isOpen={isOpen}
          displayName={displayName}
          farmName={farmName}
          houseName={houseName}
          zoneName={zoneName}
          farms={farms}
          houses={houses ?? []}
          zones={zones ?? []}
          currentFarmId={currentFarmId ?? ''}
          currentHouseId={currentHouseId ?? ''}
          selectedZoneId={selectedZoneId}
          onToggle={() => setIsOpen(prev => !prev)}
          onSelectFarm={fId => { setActiveFarmId(fId); setActiveHouseId(null) }}
          onSelectHouse={(hId) => { setActiveHouseId(hId); setHouse(hId) }}
          onSelectZone={handleSelectZone}
        />
      </div>
    </div>
  )
}
