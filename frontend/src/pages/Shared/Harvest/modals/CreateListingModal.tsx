import { useState, FormEvent } from 'react'
import { useCreateListing } from '@/hooks/useMarketplace'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import type { HarvestBatch } from '@/types'

export default function CreateListingModal({ open, onClose, batch, farmId }: { open: boolean; onClose: () => void; batch: HarvestBatch; farmId: string }) {
  const createListing = useCreateListing(farmId)
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState({ title: '', description: '', price_vnd: '', show_phone: true, show_email: false, show_zalo: true })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createListing.mutate(
      {
        harvest_batch_id: batch._id,
        title: form.title,
        description: form.description || undefined,
        price_vnd: form.price_vnd ? Number(form.price_vnd) : undefined,
        contact_info: { show_phone: form.show_phone, show_email: form.show_email, show_zalo: form.show_zalo },
      },
      {
        onSuccess: () => { push('Đã đăng bán'); onClose() },
        onError: (err) => push(getApiErrorMessage(err, 'Đăng bán thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Đăng bán trên chợ yến">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Tiêu đề" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Yến thô nguyên chất Nhà Yến Minh Phát" />
        <Textarea label="Mô tả" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <Input label="Giá tham khảo (VNĐ)" type="number" min={0} value={form.price_vnd} onChange={e => setForm(f => ({ ...f, price_vnd: e.target.value }))} />
        <div>
          <p className="label-caption mb-2">Hiện thông tin liên hệ</p>
          <div className="flex flex-wrap gap-4">
            {(['show_phone', 'show_email', 'show_zalo'] as const).map(key => (
              <label key={key} className="flex items-center gap-2 text-sm text-charcoal">
                <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                {key === 'show_phone' ? 'Điện thoại' : key === 'show_email' ? 'Email' : 'Zalo'}
              </label>
            ))}
          </div>
        </div>
        <Button type="submit" loading={createListing.isPending} className="w-full">Đăng bán</Button>
      </form>
    </Modal>
  )
}
