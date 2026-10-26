import { useState, useEffect, FormEvent } from 'react'
import { useCreateTechnician } from '@/hooks/admin/useUsers'
import { PASSWORD_MIN, validateNewUser, type Field, type FormState } from '@/validations/admin/user.validation'
import { Button, Input, Modal, ModalHeader } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'

const EMPTY_FORM: FormState = { full_name: '', email: '', phone: '', password: '' }

/**
 * AUTH-FR-005c — Admin chỉ tạo tài khoản Kỹ thuật viên (POST /admin/technicians). Technician thấy thiết bị của
 * mọi farm, không gắn farm nào (FARM-FR-009). Farm Owner tự đăng ký, chuyên gia do Primary Owner mời.
 * Admin tự đặt mật khẩu ban đầu (backend không tự sinh/gửi mail).
 * Lỗi chỉ hiện sau khi người dùng rời ô (blur) hoặc đã bấm submit — không đỏ cả form lúc mới mở.
 */
export default function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTechnician = useCreateTechnician()
  const push = useToastStore(s => s.push)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  // Modal không unmount giữa các lần mở (chỉ toggle `open`) — reset form mỗi lần mở lại.
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
    createTechnician.mutate(
      {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.replace(/[\s.-]/g, '') || undefined,
      },
      {
        onSuccess: () => { push('Đã tạo tài khoản kỹ thuật viên'); onClose() },
        // 409 "Email đã được đăng ký"... — backend trả message tiếng Việt sẵn
        onError: (err) => push(getApiErrorMessage(err, 'Tạo tài khoản thất bại'), 'error'),
      },
    )
  }

  const title = t('Tạo tài khoản kỹ thuật viên')

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={title}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title={title} description="Kỹ thuật viên thấy thiết bị và cảnh báo thiết bị của mọi trang trại" />

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
            // Nhãn gọn; yêu cầu độ dài đã nằm ở placeholder và thông báo lỗi
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
          <Button type="submit" loading={createTechnician.isPending}>Tạo tài khoản</Button>
        </div>
      </form>
    </Modal>
  )
}
