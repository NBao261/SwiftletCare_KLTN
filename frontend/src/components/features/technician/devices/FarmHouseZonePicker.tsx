import { useFarms, useHouses, useZones } from '@/hooks/shared/useFarms'
import { SelectMenu } from '@/components/ui'

export interface FarmHouseZonePickerValue { farmId: string; houseId: string; zoneId: string }

interface FarmHouseZonePickerProps {
  value: Partial<FarmHouseZonePickerValue>
  onChange: (value: Partial<FarmHouseZonePickerValue>) => void
}

/**
 * 3 select lồng nhau Farm → House → Zone, dùng để chọn Zone ĐÍCH khi dời thiết
 * bị (FARM-FR-007b, Flow 21 Nhánh A — xem TechnicianDevicesPage.tsx). Khác `ZonePicker`
 * (Farm→Zone phẳng qua useFarmZones, gộp House vào label) vì ở đây cần biết rõ
 * cả 3 cấp để người dùng dễ định vị đúng Zone trong Farm nhiều House/tầng.
 */
export default function FarmHouseZonePicker({ value, onChange }: FarmHouseZonePickerProps) {
  const { data: farms, isLoading: loadingFarms } = useFarms()
  const { data: houses, isLoading: loadingHouses } = useHouses(value.farmId)
  const { data: zones, isLoading: loadingZones } = useZones(value.houseId)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">
          Trang trại <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
        </label>
        <SelectMenu
          field
          disabled={loadingFarms}
          value={value.farmId ?? ''}
          ariaLabel="Chọn trang trại"
          options={[
            { value: '', label: '-- Chọn trang trại --' },
            ...(farms?.map(f => ({ value: f._id, label: f.name })) ?? [])
          ]}
          onChange={val => onChange({ farmId: val || undefined, houseId: undefined, zoneId: undefined })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-caption">
          Nhà <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
        </label>
        <SelectMenu
          field
          disabled={!value.farmId || loadingHouses}
          value={value.houseId ?? ''}
          ariaLabel="Chọn nhà"
          options={[
            { value: '', label: value.farmId ? '-- Chọn nhà --' : 'Chọn trang trại trước' },
            ...(houses?.map(h => ({ value: h._id, label: h.name })) ?? [])
          ]}
          onChange={val => onChange({ ...value, houseId: val || undefined, zoneId: undefined })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-caption">
          Zone <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
        </label>
        <SelectMenu
          field
          disabled={!value.houseId || loadingZones}
          value={value.zoneId ?? ''}
          ariaLabel="Chọn zone"
          options={[
            { value: '', label: value.houseId ? '-- Chọn zone --' : 'Chọn nhà trước' },
            ...(zones?.map(z => ({ value: z._id, label: z.name })) ?? [])
          ]}
          onChange={val => onChange({ ...value, zoneId: val || undefined })}
        />
      </div>
    </div>
  )
}
