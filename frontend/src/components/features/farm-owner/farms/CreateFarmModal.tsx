import { useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import { useCreateFarm } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { getApiErrorMessage } from '@/lib/helpers'

/** Tạo trang trại mới (FARM-FR-001) — mở từ màn trống lẫn nút "Tạo trang trại" ở danh sách nhà yến; tạo xong danh sách tự làm mới */
export default function CreateFarmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT(farmDict)
  const push = useToastStore(s => s.push)
  const createFarm = useCreateFarm()
  const [form, setForm] = useState({ name: '', address: '', region: '' })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createFarm.mutate(form, {
      onSuccess: () => { onClose(); setForm({ name: '', address: '', region: '' }) },
      onError: err => push(getApiErrorMessage(err, t('toast.farmCreateFailed')), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('createFarm.title')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('createFarm.name')} required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('createFarm.namePlaceholder')} />
        <Input label={t('createFarm.address')} required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        <Input label={t('createFarm.region')} value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder={t('createFarm.regionPlaceholder')} />
        <Button type="submit" loading={createFarm.isPending} className="w-full">{t('createFarm.submit')}</Button>
      </form>
    </Modal>
  )
}
