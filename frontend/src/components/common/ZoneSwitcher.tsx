import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useZoneStore } from '@/store/zoneStore'
import { useFarms, useHouses, useZones } from '@/hooks/useFarms'
import { IconCheck, IconChevronDown, IconChevronRight } from '@/components/ui/icons'
import { cn } from '@/utils/cn'

/**
 * Bộ chọn Zone trên thanh trên cùng.
 *
 * Dashboard và trang Thiết bị đều đọc `selectedZoneId` từ zoneStore, nhưng trước
 * đây muốn đổi Zone phải quay lại trang Trang trại rồi bấm "Dashboard" — bước
 * thừa lặp lại liên tục. Component này cho đổi Zone tại chỗ từ mọi màn hình.
 *
 * Chọn Farm là bước 1 (panel đơn — hầu hết tài khoản chỉ có 1-2 farm). Sau khi
 * có farm, chuyển sang flyout lồng 2 tầng Nhà → Zone: hover/click 1 nhà mở
 * panel phụ bên cạnh liệt kê zone (tầng) của nhà đó, bấm zone chọn ngay —
 * không cần quay lại như kiểu drill-down tuần tự cũ.
 */
export default function ZoneSwitcher() {
  const { selectedZoneId, selectedZoneName, setZone, clearZone } = useZoneStore()
  const [open, setOpen] = useState(false)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [openHouseId, setOpenHouseId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: farms } = useFarms()
  const { data: houses } = useHouses(farmId ?? undefined)
  const { data: zones } = useZones(openHouseId ?? undefined)

  // Đóng popover khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function reset() {
    setOpen(false)
    setFarmId(null)
    setOpenHouseId(null)
  }

  function handlePick(zoneId: string, zoneName: string) {
    const farm = farms?.find(f => f._id === farmId)
    setZone(farmId!, farm?.name ?? '', zoneId, zoneName)
    reset()
  }

  function handlePickAll() {
    clearZone()
    reset()
  }

  return (
    <div ref={containerRef} className="group/trigger relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-10 max-w-[240px] items-center gap-2 rounded-full border border-warmGray/20 bg-white pl-3 pr-2.5',
          'text-sm font-semibold text-charcoal shadow-icon transition-colors hover:bg-warmGray/5',
          open && 'bg-warmGray/5',
        )}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
        <span className="truncate">{selectedZoneName ?? 'Tất cả'}</span>
        <IconChevronDown
          width={16}
          height={16}
          className={cn('shrink-0 text-warmGray transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Hover preview — chỉ hiện khi popover đang đóng, tóm tắt khu vực đang xem trước khi bấm */}
      {!open && (
        <div className="pointer-events-none absolute right-0 z-20 mt-2 w-56 origin-top-right scale-95 rounded-xl border border-warmGray/20 bg-white p-3 opacity-0 shadow-card transition-all duration-150 group-hover/trigger:scale-100 group-hover/trigger:opacity-100">
          <p className="label-caption">Đang xem</p>
          <p className="mt-1 truncate text-sm font-semibold text-charcoal">{selectedZoneName ?? 'Tất cả nhà yến'}</p>
        </div>
      )}

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 flex items-start gap-[6px]">
          <div className="w-72 animate-fade-in overflow-hidden rounded-2xl border border-warmGray/20 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-warmGray/15 px-4 py-2.5">
              <span className="label-caption">{!farmId ? 'Chọn trang trại' : 'Chọn nhà yến'}</span>
              {farmId && (
                <button
                  onClick={() => { setFarmId(null); setOpenHouseId(null) }}
                  className="text-xs font-semibold text-charcoal hover:underline"
                >
                  Quay lại
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {!farmId && (
                <button
                  role="menuitem"
                  onClick={handlePickAll}
                  className={cn(
                    'mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                    !selectedZoneId ? 'bg-limeMist' : 'hover:bg-warmGray/10',
                  )}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span className="text-sm font-semibold text-charcoal">Tất cả nhà yến</span>
                </button>
              )}

              {!farmId &&
                (farms?.length
                  ? farms.map(farm => (
                      <PickerRow key={farm._id} label={farm.name} hint={farm.address} onClick={() => setFarmId(farm._id)} />
                    ))
                  : <EmptyRow text="Chưa có trang trại nào" />)}

              {farmId &&
                (houses?.length
                  ? houses.map(house => (
                      <PickerRow
                        key={house._id}
                        label={house.name}
                        hint={`${house.floors ?? 0} tầng`}
                        active={openHouseId === house._id}
                        onMouseEnter={() => setOpenHouseId(house._id)}
                        onClick={() => setOpenHouseId(house._id)}
                      />
                    ))
                  : <EmptyRow text="Nhà yến này chưa có tầng/khu vực" />)}
            </div>

            <button
              onClick={() => { navigate('/farms'); reset() }}
              className="w-full border-t border-warmGray/15 px-4 py-3 text-left text-sm font-semibold text-charcoal hover:bg-warmGray/10"
            >
              Quản lý trang trại
            </button>
          </div>

          {/* Flyout phụ — zone (tầng) của nhà đang hover/chọn ở panel chính */}
          {farmId && openHouseId && (
            <div className="w-[180px] animate-fade-in overflow-hidden rounded-xl border border-warmGray/15 bg-white p-2 shadow-[0_10px_28px_rgba(39,35,31,0.14)]">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-warmGray">Chọn tầng</p>
              {zones?.length
                ? zones.map(zone => <FloorRow key={zone._id} label={zone.name} active={selectedZoneId === zone._id} onClick={() => handlePick(zone._id, zone.name)} />)
                : <EmptyRow text="Chưa có zone trong nhà yến này" />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PickerRow({
  label,
  hint,
  active,
  onClick,
  onMouseEnter,
}: {
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
  onMouseEnter?: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-limeMist' : 'hover:bg-warmGray/10',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-charcoal">{label}</span>
        {hint && <span className="block truncate text-xs text-warmGray">{hint}</span>}
      </span>
      <IconChevronRight width={16} height={16} className="shrink-0 text-warmGray" />
    </button>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-sm text-warmGray">{text}</p>
}

/** Item tầng (leaf, không có chevron điều hướng tiếp) — active dùng dot Lime Mist + checkmark thay vì nền lime đặc */
function FloorRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors',
        active ? 'bg-warmGray/5' : 'hover:bg-warmGray/10',
      )}
    >
      {active
        ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-limeMist" />
        : <span className="h-1.5 w-1.5 shrink-0" />}
      <span className={cn('flex-1 truncate text-[13px]', active ? 'font-bold text-charcoal' : 'font-medium text-graphite')}>
        {label}
      </span>
      {active && <IconCheck width={14} height={14} className="shrink-0 text-charcoal" />}
    </button>
  )
}
