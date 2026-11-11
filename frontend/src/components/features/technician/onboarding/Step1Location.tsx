// Step1Location.tsx — Bước 1: Chọn loại thiết bị & vị trí lắp đặt
// I-01: Device type selector chuyển lên Step 1; ẩn Zone cho CAMERA_NODE
// I-02: Mô tả dynamic theo device type
import { Button, SelectMenu } from '@/components/ui'
import { useFarms, useHouses, useZones } from '@/hooks/shared/useFarms'
import { CheckCircle2, Thermometer, Camera, ChevronRight, ArrowRight } from 'lucide-react'
import type { OnboardingState, DeviceType } from './onboardingTypes'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
}

export function Step1Location({ data, patch, onNext }: Props) {
  const { data: farms, isLoading: loadingFarms }   = useFarms()
  const { data: houses, isLoading: loadingHouses }  = useHouses(data.location.farmId)
  const { data: zones, isLoading: loadingZones }    = useZones(data.location.houseId)

  const isCamera  = data.deviceType === 'CAMERA_NODE'
  const farmName  = farms?.find(f => f._id === data.location.farmId)?.name
  const houseName = houses?.find(h => h._id === data.location.houseId)?.name
  const zoneName  = zones?.find(z => z._id === data.location.zoneId)?.name

  // CAMERA_NODE gắn vào House (không cần Zone); SENSOR_NODE cần đủ Farm+House+Zone
  const isComplete = isCamera
    ? !!(data.location.farmId && data.location.houseId)
    : !!(data.location.farmId && data.location.houseId && data.location.zoneId)

  function handleDeviceTypeChange(t: DeviceType) {
    // Reset deviceDbId khi đổi loại; xóa zoneId khi chuyển sang CAMERA
    patch({
      deviceType: t,
      deviceDbId: '',
      location: t === 'CAMERA_NODE'
        ? { ...data.location, zoneId: undefined }
        : data.location,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 1 — Chọn loại thiết bị & vị trí</h2>
        <p className="mt-1 text-sm text-warmGray">
          {isCamera
            ? 'Chọn trang trại và nhà mà camera sẽ được gán vào.'
            : 'Chọn trang trại, nhà và zone mà thiết bị sẽ được gán vào.'}
        </p>
      </div>

      {/* I-01: Device type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Loại thiết bị</label>
        <div className="flex gap-2">
          {(['SENSOR_NODE', 'CAMERA_NODE'] as DeviceType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleDeviceTypeChange(t)}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                data.deviceType === t
                  ? 'border-charcoal bg-charcoal/5 text-charcoal'
                  : 'border-graphite/20 text-warmGray hover:border-graphite/40'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t === 'SENSOR_NODE' ? <Thermometer className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {t === 'SENSOR_NODE' ? 'Bộ điều khiển' : 'Camera'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Location selectors — inline thay vì FarmHouseZonePicker để ẩn Zone cho CAMERA */}
      <div className={`grid grid-cols-1 gap-3 ${isCamera ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {/* Trang trại */}
        <div className="flex flex-col gap-1.5">
          <label className="label-caption">
            Trang trại <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <SelectMenu
            field
            disabled={loadingFarms}
            value={data.location.farmId ?? ''}
            ariaLabel="Chọn trang trại"
            options={[
              { value: '', label: '-- Chọn trang trại --' },
              ...(farms?.map(f => ({ value: f._id, label: f.name })) ?? []),
            ]}
            onChange={val => patch({ location: { farmId: val || undefined, houseId: undefined, zoneId: undefined } })}
          />
        </div>

        {/* Nhà */}
        <div className="flex flex-col gap-1.5">
          <label className="label-caption">
            Nhà <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <SelectMenu
            field
            disabled={!data.location.farmId || loadingHouses}
            value={data.location.houseId ?? ''}
            ariaLabel="Chọn nhà"
            options={[
              { value: '', label: data.location.farmId ? '-- Chọn nhà --' : 'Chọn trang trại trước' },
              ...(houses?.map(h => ({ value: h._id, label: h.name })) ?? []),
            ]}
            onChange={val => patch({ location: { ...data.location, houseId: val || undefined, zoneId: undefined } })}
          />
        </div>

        {/* Zone — chỉ hiện cho SENSOR_NODE */}
        {!isCamera && (
          <div className="flex flex-col gap-1.5">
            <label className="label-caption">
              Zone <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
            </label>
            <SelectMenu
              field
              disabled={!data.location.houseId || loadingZones}
              value={data.location.zoneId ?? ''}
              ariaLabel="Chọn zone"
              options={[
                { value: '', label: data.location.houseId ? '-- Chọn zone --' : 'Chọn nhà trước' },
                ...(zones?.map(z => ({ value: z._id, label: z.name })) ?? []),
              ]}
              onChange={val => patch({ location: { ...data.location, zoneId: val || undefined } })}
            />
          </div>
        )}
      </div>

      {isComplete && (
        <div className="flex items-center gap-3 rounded-xl border border-limeMist/30 bg-limeMist/15 px-4 py-3">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="font-semibold text-charcoal">Vị trí đã chọn</p>
            <p className="flex flex-wrap items-center gap-1 text-sm text-charcoal/70">
              <span>{farmName}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-warmGray" />
              <span>{houseName}</span>
              {data.deviceType === 'SENSOR_NODE' && zoneName && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-warmGray" />
                  <span>{zoneName}</span>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!isComplete}>
          Tiếp theo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
