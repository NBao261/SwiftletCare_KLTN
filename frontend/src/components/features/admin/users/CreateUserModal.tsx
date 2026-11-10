import { useState, useEffect, FormEvent } from 'react'
import { PASSWORD_MIN, validateNewUser, type Field, type FormState } from '@/validations/admin/user.validation'
import { Button, Input, Modal, ModalHeader } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'

const EMPTY_FORM: FormState = { full_name: '', email: '', phone: '', password: '' }

/**
 * G-20: POST /admin/technicians đã xoá khỏi backend (f9d9522).
 * Modal này được giữ lại dưới dạng stub để tránh import-error tạm thời.
 * Nhi sẽ cập nhật thành modal mời FARM_TECHNICIAN qua API mới trong PR G-20.
 */
export default function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setTouched({})
    setSubmitted(false)
  }, [open])

  const errors = validateNewUser(form)
  const isValid = Object.keys(errors).length === 0
  const showError = (field: Field) => (submitted || touched[field]) ? errors[field] : undefined
  const set = (key: Field, value: string) => setForm(f => ({ ...f, [key]: value }))
  const touch = (field: Field) => setTouched(prev => ({ ...prev, [field]: true }))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!isValid) return
    // G-20: API đã bỏ — hiển thị thông báo cho người dùng biết
    push('Chức năng tạo tài khoản Kỹ thuật viên đã thay đổi. Farm Technician được Farm Owner mời qua trang Trang trại.', 'error')
    onClose()
  }

  const title = t('Tạo tài khoản kỹ thuật viên')

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={title}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title={title} description="G-20: Chức năng này đã thay đổi. Farm Technician được Farm Owner mời qua trang Trang trại (PUT /farms/houses/:houseId/technicians/:userId)." />

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
          <Input
            label="Họ tên"
            required
            placeholder="VD: Nguyễn Văn An"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            onBlur={() => touch('full_name')}
            error={showError('full_name')}
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="off"
            placeholder="VD: tech.hcm@swiftletcare.vn"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            onBlur={() => touch('email')}
            error={showError('email')}
          />
          <Input
            label="Số điện thoại"
            type="tel"
            inputMode="tel"
            placeholder="VD: 0912345678"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            onBlur={() => touch('phone')}
            error={showError('phone')}
          />
          <Input
            label="Mật khẩu"
            type="password"
            required
            autoComplete="new-password"
            placeholder={t('Ít nhất {{n}} ký tự', { n: PASSWORD_MIN })}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            onBlur={() => touch('password')}
            error={showError('password')}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit">Xác nhận</Button>
        </div>
      </form>
    </Modal>
  )
}
