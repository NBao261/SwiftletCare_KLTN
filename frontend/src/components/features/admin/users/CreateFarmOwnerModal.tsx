import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input, Modal } from '@/components/ui'
import { useCreateFarmOwner } from '@/hooks/admin/useUsers'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { validateFarmOwnerForm, type FarmOwnerForm } from '@/validations/admin/farmOwner.validation'
import { t } from '@/i18n'

const EMPTY_FORM: FarmOwnerForm = { email: '', fullName: '', phone: '' }

/**
 * AUTH-FR-005c, Report 3 §1.2 — Administrator tạo tài khoản Farm Owner của cài đặt (không có đăng ký công khai).
 * Backend sinh mật khẩu tạm, gửi qua e-mail và buộc đổi ở lần đăng nhập đầu; Admin không bao giờ thấy mật khẩu.
 */
export default function CreateFarmOwnerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createFarmOwner = useCreateFarmOwner()
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(s => s.push)
  const [form, setForm] = useState<FarmOwnerForm>(EMPTY_FORM)
  const [submitted, setSubmitted] = useState(false)
  // Kết quả gửi thư: chưa có SMTP thì Farm Owner đặt mật khẩu bằng "Quên mật khẩu" khi đã có
  const [emailed, setEmailed] = useState<boolean | null>(null)

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setSubmitted(false); setEmailed(null); createFarmOwner.reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại mỗi lần mở
  }, [open])

  const errors = validateFarmOwnerForm(form)
  const setField = (key: keyof FarmOwnerForm, value: string) => setForm(current => ({ ...current, [key]: value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    createFarmOwner.mutate(
      { email: form.email.trim(), full_name: form.fullName.trim(), ...(form.phone.trim() && { phone: form.phone.trim() }) },
      {
        onSuccess: data => {
          push(t('Đã tạo tài khoản Farm Owner'))
          setEmailed(data.temporary_password_emailed)
        },
      },
    )
  }

  const submitError = createFarmOwner.isError ? apiErrorMessage(createFarmOwner.error, t('Tạo tài khoản thất bại')) : undefined

  return (
    <Modal open={open} onClose={onClose} title="Tạo tài khoản Farm Owner" size="lg">
      {emailed === null ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-warmGray">
            {t('Hệ thống tạo mật khẩu tạm và gửi tới email này. Farm Owner phải đổi mật khẩu ở lần đăng nhập đầu.')}
          </p>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="off"
            value={form.email}
            onChange={event => setField('email', event.target.value)}
            error={submitted ? errors.email : undefined}
          />
          <Input
            label="Họ tên"
            required
            value={form.fullName}
            onChange={event => setField('fullName', event.target.value)}
            error={submitted ? errors.fullName : undefined}
          />
          <Input
            label="Số điện thoại (không bắt buộc)"
            type="tel"
            value={form.phone}
            onChange={event => setField('phone', event.target.value)}
          />
          {submitError && (
            <p role="alert" className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">{submitError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Huỷ</Button>
            <Button type="submit" loading={createFarmOwner.isPending}>Tạo tài khoản</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-charcoal">
            {emailed
              ? t('Đã gửi mật khẩu tạm tới {{email}}.', { email: form.email.trim() })
              : t('Chưa gửi được email (máy chủ chưa cấu hình gửi thư). Khi đã có, Farm Owner dùng "Quên mật khẩu" với {{email}} để đặt mật khẩu.', { email: form.email.trim() })}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Đóng</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
