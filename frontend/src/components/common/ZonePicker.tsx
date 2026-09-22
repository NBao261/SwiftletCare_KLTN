import { useFarms, useFarmZones } from '@/hooks/shared/useFarms'
import { Select } from '@/components/ui'

export interface ZonePickerValue { farmId: string; zoneId: string }

interface ZonePickerProps {
  value: Partial<ZonePickerValue>
  onChange: (value: Partial<ZonePickerValue>) => void
  zoneRequired?: boolean
}

/**
 * 2 select lồng nhau Farm → Zone, dùng trong form (tạo Harvest bắt buộc chọn
 * zone, tạo Ticket thì zone tùy chọn). Khác `ZoneSwitcher` ở AppHeader (popover
 * điều hướng) — đây là control form thường, không đụng lại component đó để
 * tránh regression UX đang chạy tốt.
 */
export default function ZonePicker({ value, onChange, zoneRequired = true }: ZonePickerProps) {
  const { data: farms, isLoading: loadingFarms } = useFarms()
  const { data: zones, isLoading: loadingZones } = useFarmZones(value.farmId)

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="Trang trại"
        required
        disabled={loadingFarms}
        value={value.farmId ?? ''}
        onChange={e => onChange({ farmId: e.target.value || undefined, zoneId: undefined })}
      >
        <option value="">-- Chọn trang trại --</option>
        {farms?.map(farm => (
          <option key={farm._id} value={farm._id}>{farm.name}</option>
        ))}
      </Select>

      <Select
        label={zoneRequired ? 'Zone' : 'Zone (tùy chọn)'}
        required={zoneRequired}
        disabled={!value.farmId || loadingZones}
        value={value.zoneId ?? ''}
        onChange={e => onChange({ ...value, zoneId: e.target.value || undefined })}
      >
        <option value="">{value.farmId ? '-- Chọn zone --' : 'Chọn trang trại trước'}</option>
        {zones?.map(zone => (
          <option key={zone._id} value={zone._id}>{zone.houseName} / {zone.name}</option>
        ))}
      </Select>
    </div>
  )
}
