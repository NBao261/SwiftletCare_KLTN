import { useState, FormEvent } from 'react'
import { useCreateHarvest } from '@/hooks/useHarvests'
import { Button, Input, Modal } from '@/components/ui'
import ZonePicker, { type ZonePickerValue } from '@/components/common/ZonePicker'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import HarvestFormFields, { type HarvestFormValues } from './HarvestFormFields'
import type { NestType } from '@/types'
import type { CreateHarvestInput } from '@/services/api/harvests'

export default function CreateHarvestModal({ open, onClose, farmId }: { open: boolean; onClose: () => void; farmId: string }) {
  const createHarvest = useCreateHarvest(farmId)
  const push = useToastStore(s => s.push)
  const [zone, setZone] = useState<Partial<ZonePickerValue>>({ farmId })
  const [harvestDate, setHarvestDate] = useState('')
  const [form, setForm] = useState<HarvestFormValues>({ nest_count: '', weight_grams: '', nest_type: 'RAW' as NestType, imagesText: '' })

  function reset() {
    setZone({ farmId })
    setHarvestDate('')
    setForm({ nest_count: '', weight_grams: '', nest_type: 'RAW', imagesText: '' })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!zone.zoneId) return
    const input: CreateHarvestInput = {
      zone_id: zone.zoneId,
      harvest_date: new Date(harvestDate).toISOString(),
      nest_count: Number(form.nest_count),
      weight_grams: Number(form.weight_grams),
      nest_type: form.nest_type,
      product_images: form.imagesText.split('\n').map(s => s.trim()).filter(Boolean),
    }
    createHarvest.mutate(input, {
      onSuccess: () => { push('Đã tạo đợt thu hoạch'); reset(); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Tạo thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo đợt thu hoạch">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ZonePicker value={zone} onChange={setZone} />
        <Input label="Ngày thu hoạch" type="date" required value={harvestDate} onChange={e => setHarvestDate(e.target.value)} />
        <HarvestFormFields form={form} setForm={setForm} imagesLabel="Ảnh sản phẩm (tùy chọn)" />
        <Button type="submit" loading={createHarvest.isPending} disabled={!zone.zoneId} className="w-full">
          Tạo
        </Button>
      </form>
    </Modal>
  )
}
