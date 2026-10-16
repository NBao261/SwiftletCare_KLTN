import { useState, useEffect, FormEvent } from 'react'
import { useUpdateTechnicianRegions } from '@/hooks/admin/useUsers'
import { Button, Input, Modal, ModalHeader, ModalSection, ModalSummaryRow } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
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
    // Popup ngang: tiêu đề + thanh ngăn; trái = tài khoản + vùng hiện tại, phải = ô vùng mới + Lưu
    <Modal open={!!user} onClose={onClose} size="xl" ariaLabel="Vùng phụ trách">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Nói hệ quả nghiệp vụ (TICKET-FR-004, FARM-FR-009) thay vì chi tiết kỹ thuật "đọc lại từ DB, không lấy từ JWT" */}
        <ModalHeader title="Vùng phụ trách" description="Kỹ thuật viên chỉ nhận ticket và quản lý trang trại thuộc các vùng này — áp dụng ngay sau khi lưu" />

        <div className="flex gap-6">
          <div className="w-60 shrink-0 border-r border-gray-200 pr-5">
            <ModalSection title="Hiện tại" padded={false}>
              <dl className="divide-y divide-gray-200">
                <ModalSummaryRow label="Kỹ thuật viên">{user?.full_name ?? '—'}</ModalSummaryRow>
                <ModalSummaryRow label="Email">{user?.email ?? '—'}</ModalSummaryRow>
                <ModalSummaryRow label="Vùng phụ trách">{user?.assigned_regions?.length ? user.assigned_regions.join(', ') : 'Chưa gán'}</ModalSummaryRow>
              </dl>
            </ModalSection>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <ModalSection title="Thay đổi">
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Vùng phụ trách mới"
                  placeholder="VD: HCMC, Long An"
                  required
                  value={regions}
                  onChange={e => setRegions(e.target.value)}
                />
                <p className="text-xs text-warmGray">{t('Nhiều vùng cách nhau bằng dấu phẩy')}</p>
              </div>
            </ModalSection>
            <div className="mt-auto flex justify-end">
              <Button type="submit" loading={updateRegions.isPending} disabled={regionList.length === 0}>Lưu</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
