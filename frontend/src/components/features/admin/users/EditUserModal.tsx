import { useState, useEffect, FormEvent } from 'react'
import { useUpdateTechnicianRegions } from '@/hooks/admin/useUsers'
import { Button, Input, Modal } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { User } from '@/types'

/**
 * Backend chỉ cho Admin sửa `assigned_regions` của Technician
 * (PUT /admin/technicians/:id/regions, Flow 21 4a-x) — không có endpoint sửa
 * full_name/phone của người khác, nên modal này chỉ có đúng 1 field.
 */
export default function EditUserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const updateRegions = useUpdateTechnicianRegions()
  const push = useToastStore(s => s.push)
  const [regions, setRegions] = useState('')

  useEffect(() => {
    if (user) setRegions(user.assigned_regions?.join(', ') ?? '')
  }, [user])

  const regionList = regions.split(',').map(r => r.trim()).filter(Boolean)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || regionList.length === 0) return
    updateRegions.mutate({ id: user._id, assigned_regions: regionList }, {
      onSuccess: () => { push('Đã cập nhật vùng phụ trách'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
    })
  }

  return (
    <Modal open={!!user} onClose={onClose} title={`Vùng phụ trách — ${user?.full_name ?? ''}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Vùng phụ trách (phân cách bằng dấu phẩy)"
          placeholder="VD: HCMC, Long An"
          required
          value={regions}
          onChange={e => setRegions(e.target.value)}
        />
        <p className="text-xs text-warmGray">
          Có hiệu lực ngay ở request kế tiếp của kỹ thuật viên (vùng được đọc lại từ DB mỗi request, không lấy từ JWT).
        </p>
        <Button type="submit" loading={updateRegions.isPending} disabled={regionList.length === 0} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
