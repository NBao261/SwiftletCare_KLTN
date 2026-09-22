import { useState, useEffect, FormEvent } from 'react'
import { useUpdateHarvest } from '@/hooks/farm-owner/useHarvests'
import { Button, Modal } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import HarvestFormFields, { type HarvestFormValues } from '@/components/features/farm-owner/harvest/HarvestFormFields'
import type { HarvestBatch } from '@/types'

function formFromBatch(batch: HarvestBatch): HarvestFormValues {
  return {
    nest_count: String(batch.nest_count), weight_grams: String(batch.weight_grams),
    nest_type: batch.nest_type, imagesText: batch.product_images.join('\n'),
  }
}

export default function EditHarvestModal({ open, onClose, batch, farmId }: { open: boolean; onClose: () => void; batch: HarvestBatch; farmId: string }) {
  const updateHarvest = useUpdateHarvest(farmId)
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<HarvestFormValues>(() => formFromBatch(batch))

  // Modal không unmount giữa các lần mở (chỉ toggle `open`) — resync form theo
  // batch mới nhất mỗi lần mở lại, tránh ghi đè bản sửa trước bằng dữ liệu cũ
  // seed từ lần mount đầu tiên.
  useEffect(() => {
    if (open) setForm(formFromBatch(batch))
  }, [open, batch])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    updateHarvest.mutate(
      {
        id: batch._id,
        nest_count: Number(form.nest_count),
        weight_grams: Number(form.weight_grams),
        nest_type: form.nest_type,
        product_images: form.imagesText.split('\n').map(s => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => { push('Đã cập nhật'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Sửa đợt thu hoạch">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <HarvestFormFields form={form} setForm={setForm} />
        <Button type="submit" loading={updateHarvest.isPending} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
