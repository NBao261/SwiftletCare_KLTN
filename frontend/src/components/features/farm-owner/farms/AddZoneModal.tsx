import { useState, type FormEvent } from 'react'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { Button, Input, Modal } from '@/components/ui'
import { useCreateZone } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { STRUCTURE_NAME_MAX_LENGTH } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { isNameTaken } from '@/components/features/farm-owner/farms/farmStructure'

// Thêm zone vào 1 nhà (POST /farms/houses/:houseId/zones)
// existingNames: tên các Zone đã có trong nhà, không cho tạo trùng
export default function AddZoneModal({ open, onClose, houseId, existingNames = [] }: { open: boolean; onClose: () => void; houseId: string; existingNames?: string[] }) {
  const { t } = useTranslation(farmDict)
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const createZone = useCreateZone(houseId)
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const isDuplicate = isNameTaken(name, existingNames)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || isDuplicate) return
    createZone.mutate({ name: trimmed }, {
      onSuccess: () => { push(t('toast.zoneCreated')); setName(''); onClose() },
      onError: err => push(apiErrorMessage(err, t('toast.zoneCreateFailed'), { 409: t('addZone.errorDuplicate') }), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('addZone.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('addZone.name')} required maxLength={STRUCTURE_NAME_MAX_LENGTH} value={name} onChange={e => setName(e.target.value)} placeholder={t('addZone.namePlaceholder')} error={isDuplicate ? t('addZone.errorDuplicate') : undefined} />
        <Button type="submit" loading={createZone.isPending} disabled={!trimmed || isDuplicate} className="w-full">{t('addZone.submit')}</Button>
      </form>
    </Modal>
  )
}
