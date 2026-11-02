import { Building2, Warehouse, Layers, ChevronDown, ChevronRight, Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FarmOption { _id: string; name: string }
interface HouseOption { _id: string; farm_id?: string; name: string }
interface ZoneOption { _id: string; house_id?: string; name: string }

interface Props {
  isOpen: boolean
  displayName?: string
  farmName?: string
  houseName?: string
  zoneName?: string
  farms: FarmOption[]
  houses: HouseOption[]
  zones: ZoneOption[]
  currentFarmId: string
  currentHouseId: string
  selectedZoneId: string | null
  onToggle: () => void
  onSelectFarm: (farmId: string) => void
  onSelectHouse: (houseId: string, houseName: string) => void
  onSelectZone: (zoneId: string, zoneName: string) => void
}

export default function ZoneSelectorDropdown({
  isOpen,
  displayName,
  farmName = '—',
  houseName = '—',
  zoneName = '—',
  farms,
  houses,
  zones,
  currentFarmId,
  currentHouseId,
  selectedZoneId,
  onToggle,
  onSelectFarm,
  onSelectHouse,
  onSelectZone,
}: Props) {
  // Fallback hiển thị nếu chỉ có displayName dạng "Farm • House • Zone"
  const resolvedFarmName = farmName !== '—' ? farmName : displayName?.split(' • ')[0] || '—'
  const resolvedHouseName = houseName !== '—' ? houseName : displayName?.split(' • ')[1] || '—'
  const resolvedZoneName = zoneName !== '—' ? zoneName : displayName?.split(' • ')[2] || '—'

  return (
    <div className="relative rounded-full">
      {/* Nút bấm hình Viên thuốc phân đoạn tone sáng kỹ thuật */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Chọn khu vực giám sát SCADA: Trang trại, Nhà yến, Tầng"
        className={cn(
          'group flex h-8 sm:h-9 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border border-warmGray/25 bg-stone/50 px-2.5 sm:px-3.5 text-xs text-charcoal shadow-sm transition-all hover:border-warmGray/40 hover:bg-stone/80 active:scale-[0.99]',
          isOpen && 'border-accent-600 bg-white ring-2 ring-accent-500/20 shadow-md',
        )}
        title={`Trang trại: ${resolvedFarmName} | Nhà: ${resolvedHouseName} | Tầng: ${resolvedZoneName}`}
      >
        {/* Phân đoạn 1: Trang trại */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-graphite transition-colors group-hover:text-charcoal">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-warmGray group-hover:text-charcoal" />
          <span className="max-w-[70px] sm:max-w-[95px] truncate text-[11px] font-medium">{resolvedFarmName}</span>
        </div>

        <span className="select-none text-[11px] font-light text-warmGray/40">/</span>

        {/* Phân đoạn 2: Nhà yến */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-graphite transition-colors group-hover:text-charcoal">
          <Warehouse className="h-3.5 w-3.5 shrink-0 text-warmGray group-hover:text-charcoal" />
          <span className="max-w-[65px] sm:max-w-[85px] truncate text-[11px] font-medium">{resolvedHouseName}</span>
        </div>

        <span className="select-none text-[11px] font-light text-warmGray/40">/</span>

        {/* Phân đoạn 3: Tầng / Zone (Vùng đang giám sát trực tiếp) */}
        <div className="flex items-center gap-1 sm:gap-1.5 font-bold text-accent-900">
          <Layers className="h-3.5 w-3.5 shrink-0 text-accent-700" />
          <span className="max-w-[65px] sm:max-w-[80px] truncate text-[11px]">{resolvedZoneName}</span>
        </div>

        {/* Mũi tên đóng/mở */}
        <ChevronDown
          className={cn(
            'ml-0.5 h-3.5 w-3.5 shrink-0 text-warmGray transition-transform duration-200 group-hover:text-charcoal',
            isOpen && 'rotate-180 text-accent-800',
          )}
        />
      </button>

      {/* Menu xổ 3 cấp SCADA Nền Trắng Đặc 100% (Solid White Opaque - Co giãn an toàn chống tràn mobile) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Vùng giám sát vi khí hậu SCADA"
          className="absolute right-0 top-full z-50 mt-2 flex w-[560px] max-w-[calc(100vw-1.5rem)] sm:max-w-[94vw] flex-col gap-3 rounded-2xl bg-white p-3.5 sm:p-4 text-charcoal shadow-[0_20px_50px_rgba(39,35,31,0.14)] border border-warmGray/25 animate-fade-in"
        >
          {/* Header thanh điều hướng */}
          <div className="flex items-center justify-between border-b border-warmGray/15 px-1 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-accent-600/40 bg-accent-50 text-accent-800">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">
                VÙNG GIÁM SÁT VI KHÍ HẬU SCADA
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-warmGray">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-600" />
              </span>
              <span>3 cấp phân quyền</span>
            </div>
          </div>

          {/* Lưới 3 cột: Trang trại • Nhà yến • Tầng */}
          <div className="grid grid-cols-3 gap-3 divide-x divide-warmGray/15">
            {/* Cột 1: Trang trại */}
            <div className="flex flex-col gap-1 pr-1">
              <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-warmGray">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-warmGray" />
                  <span>Trang trại</span>
                </div>
                <span className="rounded bg-stone px-1.5 py-0.5 text-[10px] font-semibold text-graphite">
                  {farms.length}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {farms.map(farm => {
                  const isSelected = currentFarmId === farm._id
                  return (
                    <button
                      key={farm._id}
                      type="button"
                      onClick={() => onSelectFarm(farm._id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all',
                        isSelected
                          ? 'border border-accent-600/50 bg-accent-50 font-bold text-accent-900 shadow-sm'
                          : 'border border-transparent text-graphite hover:bg-stone/60 hover:text-charcoal',
                      )}
                    >
                      <span className="truncate">{farm.name}</span>
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-opacity',
                          isSelected ? 'text-accent-800 opacity-100' : 'opacity-30',
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cột 2: Nhà yến */}
            <div className="flex flex-col gap-1 pl-3 pr-1">
              <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-warmGray">
                <div className="flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5 text-warmGray" />
                  <span>Nhà yến</span>
                </div>
                <span className="rounded bg-stone px-1.5 py-0.5 text-[10px] font-semibold text-graphite">
                  {houses.length}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {houses.length === 0 ? (
                  <div className="py-6 text-center text-xs italic text-warmGray">
                    Không có nhà yến
                  </div>
                ) : (
                  houses.map(house => {
                    const isSelected = currentHouseId === house._id
                    return (
                      <button
                        key={house._id}
                        type="button"
                        onClick={() => onSelectHouse(house._id, house.name)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all',
                          isSelected
                            ? 'border border-accent-600/50 bg-accent-50 font-bold text-accent-900 shadow-sm'
                            : 'border border-transparent text-graphite hover:bg-stone/60 hover:text-charcoal',
                        )}
                      >
                        <span className="truncate">{house.name}</span>
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-opacity',
                            isSelected ? 'text-accent-800 opacity-100' : 'opacity-30',
                          )}
                        />
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Cột 3: Tầng / Vùng */}
            <div className="flex flex-col gap-1 pl-3">
              <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-warmGray">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-accent-700" />
                  <span>Tầng / Vùng</span>
                </div>
                <span className="rounded bg-stone px-1.5 py-0.5 text-[10px] font-semibold text-graphite">
                  {zones.length}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {zones.length === 0 ? (
                  <div className="py-6 text-center text-xs italic text-warmGray">
                    Không có khu vực
                  </div>
                ) : (
                  zones.map(zone => {
                    const isSelected = selectedZoneId === zone._id
                    return (
                      <button
                        key={zone._id}
                        type="button"
                        onClick={() => onSelectZone(zone._id, zone.name)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all',
                          isSelected
                            ? 'border border-accent-600 bg-accent-100 font-bold text-accent-950 shadow-sm'
                            : 'border border-transparent text-graphite hover:bg-stone/60 hover:text-charcoal',
                        )}
                      >
                        <span className="truncate">{zone.name}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0 stroke-[2.5] text-accent-800" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer tóm tắt lựa chọn */}
          <div className="flex items-center justify-between border-t border-warmGray/15 px-1 pt-2.5 text-[11px]">
            <div className="flex items-center gap-1.5 truncate text-warmGray">
              <span>Đang chọn:</span>
              <span className="max-w-[360px] truncate font-mono font-semibold text-accent-900">
                {resolvedFarmName} <span className="text-warmGray/50">&gt;</span> {resolvedHouseName} <span className="text-warmGray/50">&gt;</span> {resolvedZoneName}
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-warmGray">
              Nhấp vào Tầng để chuyển vùng
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
