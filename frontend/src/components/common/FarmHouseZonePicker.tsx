import { useFarms, useHouses, useZones } from '@/hooks/useFarms'
import { Select } from '@/components/ui'

export interface FarmHouseZonePickerValue { farmId: string; houseId: string; zoneId: string }

interface FarmHouseZonePickerProps {
  value: Partial<FarmHouseZonePickerValue>
  onChange: (value: Partial<FarmHouseZonePickerValue>) => void
}

/**
 * 3 select lồng nhau Farm → House → Zone, dùng để chọn Zone ĐÍCH khi dời thiết
 * bị (FARM-FR-007b, Flow 21 Nhánh A — xem DevicesPage.tsx). Khác `ZonePicker`
 * (Farm→Zone phẳng qua useFarmZones, gộp House vào label) vì ở đây cần biết rõ
 * cả 3 cấp để người dùng dễ định vị đúng Zone trong Farm nhiều House/tầng.
 */
export default function FarmHouseZonePicker({ value, onChange }: FarmHouseZonePickerProps) {
  const { data: farms, isLoading: loadingFarms } = useFarms()
  const { data: houses, isLoading: loadingHouses } = useHouses(value.farmId)
  const { data: zones, isLoading: loadingZones } = useZones(value.houseId)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Select
        label="Trang trại"
        required
        disabled={loadingFarms}
        value={value.farmId ?? ''}
        onChange={e => onChange({ farmId: e.target.value || undefined, houseId: undefined, zoneId: undefined })}
      >
        <option value="">-- Chọn trang trại --</option>
        {farms?.map(farm => (
          <option key={farm._id} value={farm._id}>{farm.name}</option>
        ))}
      </Select>

      <Select
        label="Nhà"
        required
        disabled={!value.farmId || loadingHouses}
        value={value.houseId ?? ''}
        onChange={e => onChange({ ...value, houseId: e.target.value || undefined, zoneId: undefined })}
      >
        <option value="">{value.farmId ? '-- Chọn nhà --' : 'Chọn trang trại trước'}</option>
        {houses?.map(house => (
          <option key={house._id} value={house._id}>{house.name}</option>
        ))}
      </Select>

      <Select
        label="Zone"
        required
        disabled={!value.houseId || loadingZones}
        value={value.zoneId ?? ''}
        onChange={e => onChange({ ...value, zoneId: e.target.value || undefined })}
      >
        <option value="">{value.houseId ? '-- Chọn zone --' : 'Chọn nhà trước'}</option>
        {zones?.map(zone => (
          <option key={zone._id} value={zone._id}>{zone.name}</option>
        ))}
      </Select>
    </div>
  )
}
