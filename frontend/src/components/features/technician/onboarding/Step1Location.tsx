// Step1Location.tsx — Bước 1: Chọn vị trí lắp đặt (Farm / House / Zone)
import { Button } from '@/components/ui'
import FarmHouseZonePicker from '@/components/features/technician/devices/FarmHouseZonePicker'
import { useFarms, useHouses, useZones } from '@/hooks/shared/useFarms'
import type { OnboardingState } from './onboardingTypes'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
}

export function Step1Location({ data, patch, onNext }: Props) {
  const { data: farms }  = useFarms()
  const { data: houses } = useHouses(data.location.farmId)
  const { data: zones }  = useZones(data.location.houseId)

  const farmName  = farms?.find(f => f._id === data.location.farmId)?.name
  const houseName = houses?.find(h => h._id === data.location.houseId)?.name
  const zoneName  = zones?.find(z => z._id === data.location.zoneId)?.name

  const isComplete = !!(data.location.farmId && data.location.houseId && data.location.zoneId)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 1 — Chọn vị trí lắp đặt</h2>
        <p className="mt-1 text-sm text-warmGray">Chọn trang trại, nhà và zone mà thiết bị sẽ được gán vào.</p>
      </div>

      <FarmHouseZonePicker
        value={data.location}
        onChange={(loc) => patch({ location: loc })}
      />

      {isComplete && (
        <div className="flex items-center gap-2.5 rounded-xl border border-limeMist/30 bg-limeMist/15 px-4 py-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-semibold text-charcoal">Vị trí đã chọn</p>
            <p className="text-sm text-charcoal/70">{farmName} › {houseName} › {zoneName}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!isComplete}>Tiếp theo →</Button>
      </div>
    </div>
  )
}
