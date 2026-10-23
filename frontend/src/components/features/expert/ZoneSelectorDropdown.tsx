/**
 * ZoneSelectorDropdown — Bộ chọn Zone 3 cấp (Trang trại • Nhà yến • Tầng)
 * Dạng pill dropdown góc phải thanh SCADA
 * SRS: ENV-FR-006, EXPERT-FR-001
 */

import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FarmOption { _id: string; name: string }
interface HouseOption { _id: string; farm_id?: string; name: string }
interface ZoneOption { _id: string; house_id?: string; name: string }

interface Props {
  isOpen: boolean
  displayName: string
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
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/20',
          isOpen && 'bg-white/20 border-white/30',
        )}
      >
        <span className="max-w-[280px] truncate">{displayName}</span>
        <ChevronDown
          width={14}
          height={14}
          className={cn('shrink-0 text-white/70 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-auto min-w-[320px] animate-fade-in gap-2 rounded-2xl border border-warmGray/20 bg-white p-3 text-charcoal shadow-modal">
          {/* Cột 1: Chọn Trang trại & Nhà yến */}
          <div className="flex w-52 flex-col gap-1 border-r border-warmGray/15 pr-2">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-warmGray">
              Trang trại
            </p>
            {farms.map(farm => (
              <button
                key={farm._id}
                type="button"
                onClick={() => onSelectFarm(farm._id)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold transition-colors',
                  currentFarmId === farm._id ? 'bg-charcoal text-white' : 'text-graphite hover:bg-warmGray/10',
                )}
              >
                <span className="truncate">{farm.name}</span>
                <ChevronRight width={12} height={12} className="shrink-0 opacity-70" />
              </button>
            ))}

            <div className="my-1 border-t border-warmGray/15" />

            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-warmGray">
              Nhà yến
            </p>
            {houses.map(house => (
              <button
                key={house._id}
                type="button"
                onClick={() => onSelectHouse(house._id, house.name)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold transition-colors',
                  currentHouseId === house._id ? 'bg-limeMist text-charcoal font-bold' : 'text-graphite hover:bg-warmGray/10',
                )}
              >
                <span className="truncate">{house.name}</span>
                <ChevronRight width={12} height={12} className="shrink-0 text-warmGray" />
              </button>
            ))}
          </div>

          {/* Cột 2: Chọn Tầng (Zone) */}
          <div className="flex w-52 flex-col gap-1 pl-1">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-warmGray">
              Tầng / Khu vực
            </p>
            {zones.map(zone => {
              const isSelected = selectedZoneId === zone._id
              return (
                <button
                  key={zone._id}
                  type="button"
                  onClick={() => onSelectZone(zone._id, zone.name)}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected ? 'bg-warmGray/10 font-bold text-charcoal' : 'text-graphite hover:bg-warmGray/5',
                  )}
                >
                  <span className="truncate">{zone.name}</span>
                  {isSelected && <Check width={14} height={14} className="shrink-0 text-charcoal" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
