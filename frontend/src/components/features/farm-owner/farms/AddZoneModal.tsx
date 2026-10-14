import { useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import { useCreateZone } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { getApiErrorMessage } from '@/lib/helpers'

/** Thêm zone vào 1 nhà (POST /farms/houses/:houseId/zones) */
export default function AddZoneModal({ open, onClose, houseId }: { open: boolean; onClose: () => void; houseId: string }) {
  const { t } = useTranslation(farmDict)
  const push = useToastStore(s => s.push)
  const createZone = useCreateZone(houseId)
  const [name, setName] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createZone.mutate({ name }, {
      onSuccess: () => { push(t('toast.zoneCreated')); setName(''); onClose() },
      onError: err => push(getApiErrorMessage(err, t('toast.zoneCreateFailed')), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('addZone.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('addZone.name')} required value={name} onChange={e => setName(e.target.value)} placeholder={t('addZone.namePlaceholder')} />
        <Button type="submit" loading={createZone.isPending} className="w-full">{t('addZone.submit')}</Button>
      </form>
    </Modal>
  )
}
