import { useState, type FormEvent } from 'react'
import { MapPinIcon } from '@phosphor-icons/react'
import { Button, Input, Modal } from '@/components/ui'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useCreateFarm, useUpdateFarm } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { validateFarmLocation } from '@/validations/farm-owner/farm.validation'
import type { Farm } from '@/types'

interface FarmFormModalProps {
  // Có thì là sửa farm đó; không có thì tạo mới
  farm?: Farm
  onClose: () => void
}

// Tạo / sửa trang trại (FARM-FR-001): tên, địa chỉ chi tiết, vị trí (bắt buộc khi tạo — một farm là một địa điểm)
export default function FarmFormModal({ farm, onClose }: FarmFormModalProps) {
  const { t } = useTranslation(farmDict)
  const isEdit = farm !== undefined
  const createFarm = useCreateFarm()
  const updateFarm = useUpdateFarm(farm?._id ?? '')
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [name, setName] = useState(farm?.name ?? '')
  const [address, setAddress] = useState(farm?.address ?? '')
  const [latitude, setLatitude] = useState(farm?.coordinates ? String(farm.coordinates.lat) : '')
  const [longitude, setLongitude] = useState(farm?.coordinates ? String(farm.coordinates.lng) : '')
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<FarmKey | null>(null)
  const isSaving = createFarm.isPending || updateFarm.isPending

  // Lấy tọa độ GPS của máy — dùng khi đang đứng ở nhà yến
  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      setError('farmForm.locationUnavailable')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      position => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
        setError(null)
        setIsLocating(false)
      },
      reason => {
        setError(reason.code === reason.PERMISSION_DENIED ? 'farmForm.locationDenied' : 'farmForm.locationUnavailable')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!name.trim() || !address.trim()) {
      setError('farmForm.errorRequired')
      return
    }
    const locationError = validateFarmLocation(latitude, longitude, !isEdit)
    if (locationError) {
      setError(locationError)
      return
    }
    setError(null)
    // Sửa farm để trống cả 2 ô vị trí thì không gửi, backend giữ vị trí cũ
    const coordinates = latitude.trim() ? { lat: Number(latitude), lng: Number(longitude) } : undefined
    const input = { name: name.trim(), address: address.trim() }
    if (isEdit) {
      updateFarm.mutate({ ...input, ...(coordinates && { coordinates }) }, {
        onSuccess: () => {
          push(t('farmForm.updated'))
          onClose()
        },
        onError: reason => push(apiErrorMessage(reason, t('farmForm.updateFailed')), 'error'),
      })
      return
    }
    if (!coordinates) return
    createFarm.mutate({ ...input, coordinates }, {
      onSuccess: () => {
        push(t('farmForm.created'))
        onClose()
      },
      onError: reason => push(apiErrorMessage(reason, t('toast.farmCreateFailed')), 'error'),
    })
  }

  const isLocationError = error === 'farmForm.errorLocationRequired'

  return (
    <Modal open onClose={onClose} title={isEdit ? t('farmForm.editTitle') : t('createFarm.title')}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input name="farmName" label={t('createFarm.name')} required value={name} onChange={event => setName(event.target.value)} placeholder={t('createFarm.namePlaceholder')} />
        <Input
          name="farmAddress"
          label={t('farmForm.address')}
          required
          value={address}
          onChange={event => setAddress(event.target.value)}
          placeholder={t('farmForm.addressPlaceholder')}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label-caption">
              {t('farmForm.location')}
              {!isEdit && <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>}
            </span>
            <Button type="button" variant="secondary" size="sm" loading={isLocating} onClick={handleUseCurrentLocation}>
              <MapPinIcon size={14} weight="bold" />
              {t('farmForm.useCurrentLocation')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="latitude"
              label={t('farmForm.latitude')}
              inputMode="decimal"
              value={latitude}
              onChange={event => setLatitude(event.target.value)}
              placeholder="10.762622"
              aria-invalid={isLocationError || error === 'farmForm.errorLatitude'}
            />
            <Input
              name="longitude"
              label={t('farmForm.longitude')}
              inputMode="decimal"
              value={longitude}
              onChange={event => setLongitude(event.target.value)}
              placeholder="106.660172"
              aria-invalid={isLocationError || error === 'farmForm.errorLongitude'}
            />
          </div>
          <p className="text-xs text-warmGray">{t('farmForm.locationHint')}</p>
        </div>
        {error && <p className="text-xs text-alertRed">{t(error)}</p>}
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('farmForm.cancel')}</Button>
          <Button type="submit" className="min-w-[8rem]" loading={isSaving}>{isEdit ? t('farmForm.save') : t('createFarm.submit')}</Button>
        </div>
      </form>
    </Modal>
  )
}
