import { useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import SelectMenu from '@/components/ui/SelectMenu'
import { useCreateHouse } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { isNameTaken } from '@/components/features/farm-owner/farms/farmStructure'
import type { Farm } from '@/types'

interface AddHouseModalProps {
  open: boolean
  onClose: () => void
  farms: Farm[]
  // Tên các nhà yến đã có của chủ nhà yến — không cho tạo nhà trùng tên
  existingNames?: string[]
}

/** Thêm nhà yến (POST /farms/:id/houses) — chọn farm ngay trong form vì màn tổng quan gộp nhà của mọi farm */
export default function AddHouseModal({ open, onClose, farms, existingNames = [] }: AddHouseModalProps) {
  const { t } = useTranslation(farmDict)
  const push = useToastStore(s => s.push)
  const [farmId, setFarmId] = useState('')
  const [name, setName] = useState('')
  const [floors, setFloors] = useState('')
  const [description, setDescription] = useState('')
  const [floorsError, setFloorsError] = useState(false)
  const apiErrorMessage = useApiErrorMessage()
  const selectedFarmId = farmId || farms[0]?._id || ''
  const createHouse = useCreateHouse(selectedFarmId)
  const isDuplicate = isNameTaken(name, existingNames)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Số tầng tuỳ chọn; có nhập thì phải là số nguyên ≥ 1
    const floorCount = floors.trim() === '' ? undefined : Number(floors)
    const isFloorsInvalid = floorCount !== undefined && (!Number.isInteger(floorCount) || floorCount < 1)
    setFloorsError(isFloorsInvalid)
    if (isFloorsInvalid || isDuplicate) return
    const input = { name: name.trim(), ...(floorCount !== undefined && { floors: floorCount }), ...(description.trim() && { description: description.trim() }) }
    createHouse.mutate(input, {
      onSuccess: () => {
        push(t('toast.houseCreated'))
        setName('')
        setFloors('')
        setDescription('')
        onClose()
      },
      onError: err => push(apiErrorMessage(err, t('toast.houseCreateFailed')), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('addHouse.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {farms.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="label-caption">{t('addHouse.farm')}</span>
            <SelectMenu
              field
              ariaLabel={t('addHouse.farm')}
              value={selectedFarmId}
              onChange={setFarmId}
              options={farms.map(f => ({ value: f._id, label: f.name }))}
            />
          </div>
        )}
        <Input
          label={t('addHouse.name')}
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('addHouse.namePlaceholder')}
          error={isDuplicate ? t('addHouse.errorDuplicate') : undefined}
        />
        <Input
          label={t('addHouse.floors')}
          type="number"
          min={1}
          step={1}
          value={floors}
          onChange={e => setFloors(e.target.value)}
          placeholder={t('addHouse.floorsPlaceholder')}
          error={floorsError ? t('addHouse.errorFloors') : undefined}
        />
        <Input label={t('addHouse.description')} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('addHouse.descriptionPlaceholder')} />
        <Button type="submit" loading={createHouse.isPending} disabled={isDuplicate} className="w-full">{t('addHouse.submit')}</Button>
      </form>
    </Modal>
  )
}
