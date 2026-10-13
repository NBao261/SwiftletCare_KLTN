import { useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import SelectMenu from '@/components/ui/SelectMenu'
import { useCreateHouse } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { getApiErrorMessage } from '@/lib/helpers'
import type { Farm } from '@/types'

interface AddHouseModalProps { open: boolean; onClose: () => void; farms: Farm[] }

/** Thêm nhà yến (POST /farms/:id/houses) — chọn farm ngay trong form vì màn tổng quan gộp nhà của mọi farm */
export default function AddHouseModal({ open, onClose, farms }: AddHouseModalProps) {
  const { t } = useT(farmDict)
  const push = useToastStore(s => s.push)
  const [farmId, setFarmId] = useState('')
  const [name, setName] = useState('')
  const selectedFarmId = farmId || farms[0]?._id || ''
  const createHouse = useCreateHouse(selectedFarmId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createHouse.mutate({ name }, {
      onSuccess: () => { push(t('toast.houseCreated')); setName(''); onClose() },
      onError: err => push(getApiErrorMessage(err, t('toast.houseCreateFailed')), 'error'),
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
        <Input label={t('addHouse.name')} required value={name} onChange={e => setName(e.target.value)} placeholder={t('addHouse.namePlaceholder')} />
        <Button type="submit" loading={createHouse.isPending} className="w-full">{t('addHouse.submit')}</Button>
      </form>
    </Modal>
  )
}
