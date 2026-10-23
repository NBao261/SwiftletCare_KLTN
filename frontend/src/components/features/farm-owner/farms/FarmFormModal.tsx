import { useState, type FormEvent } from 'react'
import { Button, Input, Modal, SelectMenu } from '@/components/ui'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useCreateFarm, useRegions, useUpdateFarm } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import type { Farm } from '@/types'

interface FarmFormModalProps {
  // Có thì là sửa farm đó; không có thì tạo mới
  farm?: Farm
  // Chỉ Primary Owner / Admin đổi được khu vực (FARM-FR-001); tạo mới thì luôn chọn được
  canChangeRegion?: boolean
  onClose: () => void
}

// Tạo / sửa trang trại (FARM-FR-001, 009): tên, khu vực chọn từ danh mục 34 tỉnh/thành (bắt buộc), địa chỉ chi tiết
export default function FarmFormModal({ farm, canChangeRegion = true, onClose }: FarmFormModalProps) {
  const { t } = useTranslation(farmDict)
  const isEdit = farm !== undefined
  const { data: regions, isLoading: isLoadingRegions } = useRegions()
  const createFarm = useCreateFarm()
  const updateFarm = useUpdateFarm(farm?._id ?? '')
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [name, setName] = useState(farm?.name ?? '')
  const [region, setRegion] = useState(farm?.region ?? '')
  const [address, setAddress] = useState(farm?.address ?? '')
  const [error, setError] = useState<FarmKey | null>(null)
  const isSaving = createFarm.isPending || updateFarm.isPending

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!name.trim() || !address.trim()) {
      setError('farmForm.errorRequired')
      return
    }
    if (!region) {
      setError('farmForm.errorRegion')
      return
    }
    setError(null)
    const input = { name: name.trim(), address: address.trim(), region }
    if (isEdit) {
      // Không có quyền đổi khu vực thì không gửi trường này (backend chặn 403)
      const { region: _region, ...withoutRegion } = input
      updateFarm.mutate(canChangeRegion ? input : withoutRegion, {
        onSuccess: () => {
          push(t('farmForm.updated'))
          onClose()
        },
        onError: reason => push(apiErrorMessage(reason, t('farmForm.updateFailed')), 'error'),
      })
      return
    }
    createFarm.mutate(input, {
      onSuccess: () => {
        push(t('farmForm.created'))
        onClose()
      },
      onError: reason => push(apiErrorMessage(reason, t('toast.farmCreateFailed')), 'error'),
    })
  }

  const regionOptions = [
    { value: '', label: isLoadingRegions ? t('farmForm.regionLoading') : t('farmForm.regionPick') },
    ...(regions ?? []).map(item => ({ value: item.code, label: item.name })),
  ]

  return (
    <Modal open onClose={onClose} title={isEdit ? t('farmForm.editTitle') : t('createFarm.title')}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label={t('createFarm.name')} required value={name} onChange={event => setName(event.target.value)} placeholder={t('createFarm.namePlaceholder')} />
        <div className="flex flex-col gap-1.5">
          <span className="label-caption">
            {t('createFarm.region')}
            <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </span>
          <SelectMenu
            field
            ariaLabel={t('createFarm.region')}
            value={region}
            onChange={setRegion}
            options={regionOptions}
            disabled={isLoadingRegions || !canChangeRegion}
            invalid={error === 'farmForm.errorRegion'}
          />
          <p className="text-xs text-warmGray">{t(canChangeRegion ? 'farmForm.regionHint' : 'farmForm.regionLocked')}</p>
        </div>
        <Input
          label={t('farmForm.address')}
          required
          value={address}
          onChange={event => setAddress(event.target.value)}
          placeholder={t('farmForm.addressPlaceholder')}
        />
        {error && <p className="text-xs text-alertRed">{t(error)}</p>}
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('farmForm.cancel')}</Button>
          <Button type="submit" className="min-w-[8rem]" loading={isSaving}>{isEdit ? t('farmForm.save') : t('createFarm.submit')}</Button>
        </div>
      </form>
    </Modal>
  )
}
