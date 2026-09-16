import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useZoneStore } from '@/store/zoneStore'
import { useFarms, useHouses, useZones } from '@/hooks/useFarms'
import { IconChevronDown, IconChevronRight, IconPin } from '@/components/ui/icons'
import { cn } from '@/utils/cn'

/**
 * Bộ chọn Zone trên thanh trên cùng.
 *
 * Dashboard và trang Thiết bị đều đọc `selectedZoneId` từ zoneStore, nhưng trước
 * đây muốn đổi Zone phải quay lại trang Trang trại rồi bấm "Dashboard" — bước
 * thừa lặp lại liên tục. Component này cho đổi Zone tại chỗ từ mọi màn hình:
 * chọn Farm → House → Zone ngay trong 1 popover.
 */
export default function ZoneSwitcher() {
  const { selectedZoneId, selectedZoneName, setZone } = useZoneStore()
  const [open, setOpen] = useState(false)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [houseId, setHouseId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: farms } = useFarms()
  const { data: houses } = useHouses(farmId ?? undefined)
  const { data: zones } = useZones(houseId ?? undefined)

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

  function handlePick(zoneId: string, zoneName: string) {
    const farm = farms?.find(f => f._id === farmId)
    setZone(farmId!, farm?.name ?? '', zoneId, zoneName)
    setOpen(false)
    setFarmId(null)
    setHouseId(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-10 max-w-[240px] items-center gap-2 rounded-full border border-warmGray/15 pl-3 pr-2.5',
          'text-sm font-semibold text-charcoal transition-colors hover:bg-warmGray/10',
          open && 'bg-warmGray/10',
        )}
      >
        <IconPin width={16} height={16} className="shrink-0 text-warmGray" />
        <span className="truncate">{selectedZoneName ?? 'Chọn khu vực'}</span>
        <IconChevronDown
          width={16}
          height={16}
          className={cn('shrink-0 text-warmGray transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-72 animate-fade-in overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-warmGray/15 px-4 py-2.5">
            <span className="label-caption">
              {!farmId ? 'Chọn trang trại' : !houseId ? 'Chọn nhà yến' : 'Chọn zone'}
            </span>
            {farmId && (
              <button
                onClick={() => (houseId ? setHouseId(null) : setFarmId(null))}
                className="text-xs font-semibold text-charcoal hover:underline"
              >
                Quay lại
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {!farmId &&
              (farms?.length
                ? farms.map(farm => (
                    <PickerRow key={farm._id} label={farm.name} hint={farm.address} onClick={() => setFarmId(farm._id)} />
                  ))
                : <EmptyRow text="Chưa có trang trại nào" />)}

            {farmId && !houseId &&
              (houses?.length
                ? houses.map(house => (
                    <PickerRow key={house._id} label={house.name} hint={`${house.floors ?? 0} tầng`} onClick={() => setHouseId(house._id)} />
                  ))
                : <EmptyRow text="Nhà yến này chưa có tầng/khu vực" />)}

            {houseId &&
              (zones?.length
                ? zones.map(zone => (
                    <PickerRow
                      key={zone._id}
                      label={zone.name}
                      hint={selectedZoneId === zone._id ? 'Đang xem' : undefined}
                      active={selectedZoneId === zone._id}
                      onClick={() => handlePick(zone._id, zone.name)}
                    />
                  ))
                : <EmptyRow text="Chưa có zone trong nhà yến này" />)}
          </div>

          <button
            onClick={() => {
              setOpen(false)
              navigate('/farms')
            }}
            className="w-full border-t border-warmGray/15 px-4 py-3 text-left text-sm font-semibold text-charcoal hover:bg-warmGray/10"
          >
            Quản lý trang trại
          </button>
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
}: {
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
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
