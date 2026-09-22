import { useState, useEffect, FormEvent } from 'react'
import { useCreateUser, type AdminCreatableRole } from '@/hooks/admin/useUsers'
import { PASSWORD_MIN, parseRegions, validateNewUser, type Field, type FormState } from '@/validations/admin/user.validation'
import { useFarms } from '@/hooks/shared/useFarms'
import { Button, Input, Modal } from '@/components/ui'
import { IconUser, IconHeadset } from '@/components/ui/icons'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/components/features/admin/users/users.constants'

const CREATABLE_ROLES: AdminCreatableRole[] = ['TECHNICIAN', 'SALES_STAFF']
/** Icon nhận diện nhanh 2 loại tài khoản: Technician = người (kỹ thuật viên hiện trường), Sales Staff = tai nghe (kinh doanh/chăm sóc khách) */
const ROLE_ICON: Record<AdminCreatableRole, typeof IconUser> = { TECHNICIAN: IconUser, SALES_STAFF: IconHeadset }
const EMPTY_FORM: FormState = { role: 'TECHNICIAN', full_name: '', email: '', phone: '', password: '', regions: '', farmIds: [] }

/**
 * AUTH-FR-005c, Flow 16 bước 1a — 1 modal cho cả 2 loại tài khoản Admin được
 * tạo (RACI mục 4.4: không tạo Farm Owner, Admin là tài khoản gốc seed):
 * - Technician → POST /admin/technicians, bắt buộc `assigned_regions`
 * - Sales Staff → POST /admin/sales-staff, bắt buộc `farm_ids` (≥1 farm đang tồn tại)
 * Admin tự đặt mật khẩu ban đầu (backend không tự sinh/gửi mail ở 2 endpoint này).
 * Lỗi chỉ hiện sau khi người dùng rời ô (blur) hoặc đã bấm submit — không đỏ cả form lúc mới mở.
 */
export default function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createUser = useCreateUser()
  const { data: farms, isLoading: farmsLoading } = useFarms()
  const push = useToastStore(s => s.push)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  // Modal không unmount giữa các lần mở (chỉ toggle `open`) — reset form mỗi lần mở lại.
  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setTouched({}); setSubmitted(false) }
  }, [open])

  const errors = validateNewUser(form)
  const isValid = Object.keys(errors).length === 0
  const showError = (field: Field) => (submitted || touched[field]) ? errors[field] : undefined
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }))
  const touch = (field: Field) => setTouched(t => ({ ...t, [field]: true }))

  function toggleFarm(id: string) {
    touch('farmIds')
    set('farmIds', form.farmIds.includes(id) ? form.farmIds.filter(x => x !== id) : [...form.farmIds, id])
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!isValid) return
    const base = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      full_name: form.full_name.trim(),
      phone: form.phone.replace(/[\s.-]/g, '') || undefined,
    }
    createUser.mutate(
      form.role === 'TECHNICIAN'
        ? { role: form.role, ...base, assigned_regions: parseRegions(form.regions) }
        : { role: form.role, ...base, farm_ids: form.farmIds },
      {
        onSuccess: () => { push(`Đã tạo tài khoản ${ROLE_LABEL[form.role]}`); onClose() },
        // 409 "Email đã được đăng ký" / 404 farm không tồn tại... — backend trả message tiếng Việt sẵn
        onError: (err) => push(getApiErrorMessage(err, 'Tạo tài khoản thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo tài khoản">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="label-caption">
            Vai trò<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            {CREATABLE_ROLES.map(r => {
              const Icon = ROLE_ICON[r]
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('role', r)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-small font-semibold transition-colors',
                    form.role === r
                      ? 'border-charcoal bg-charcoal text-white'
                      : 'border-warmGray/25 bg-white text-charcoal hover:bg-warmGray/10',
                  )}
                >
                  {/* Cùng kiểu icon nav active ở SideBar: vòng tròn Lime Mist khi đang chọn, icon trần khi không */}
                  {form.role === r ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
                      <Icon width={16} height={16} />
                    </span>
                  ) : (
                    <Icon width={16} height={16} className="shrink-0 text-warmGray" />
                  )}
                  {ROLE_LABEL[r]}
                </button>
              )
            })}
          </div>
        </div>

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
          label="Số điện thoại (tùy chọn)"
          type="tel"
          inputMode="tel"
          placeholder="VD: 0912345678"
          value={form.phone}
          onChange={e => set('phone', e.target.value)}
          onBlur={() => touch('phone')}
          error={showError('phone')}
        />
        <Input
          label={`Mật khẩu ban đầu (≥ ${PASSWORD_MIN} ký tự)`}
          type="password"
          required
          autoComplete="new-password"
          placeholder={`Ít nhất ${PASSWORD_MIN} ký tự, nên có chữ hoa, số và ký tự đặc biệt`}
          value={form.password}
          onChange={e => set('password', e.target.value)}
          onBlur={() => touch('password')}
          error={showError('password')}
        />

        {form.role === 'TECHNICIAN' && (
          <Input
            label="Vùng phụ trách (phân cách bằng dấu phẩy)"
            required
            placeholder="VD: HCMC, Long An"
            value={form.regions}
            onChange={e => set('regions', e.target.value)}
            onBlur={() => touch('regions')}
            error={showError('regions')}
          />
        )}

        {form.role === 'SALES_STAFF' && (
          <div className="flex flex-col gap-1.5">
            <span className="label-caption">
              Farm phụ trách (chọn ít nhất 1)<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
            </span>
            {farmsLoading && <p className="text-sm text-warmGray">Đang tải danh sách farm...</p>}
            {!farmsLoading && !farms?.length && (
              <p className="text-sm text-warmGray">Chưa có farm nào trong hệ thống để gán.</p>
            )}
            {!!farms?.length && (
              <div className={cn(
                'flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border p-2',
                showError('farmIds') ? 'border-alertRed' : 'border-warmGray/25',
              )}>
                {farms.map(f => (
                  <label key={f._id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-warmGray/10">
                    <input type="checkbox" className="accent-success" checked={form.farmIds.includes(f._id)} onChange={() => toggleFarm(f._id)} />
                    <span className="truncate text-charcoal">{f.name}</span>
                    {f.region && <span className="ml-auto shrink-0 text-xs text-warmGray">{f.region}</span>}
                  </label>
                ))}
              </div>
            )}
            {showError('farmIds') && <span className="text-xs text-alertRed">{errors.farmIds}</span>}
          </div>
        )}

        <Button type="submit" loading={createUser.isPending} className="w-full">
          Tạo tài khoản
        </Button>
      </form>
    </Modal>
  )
}
