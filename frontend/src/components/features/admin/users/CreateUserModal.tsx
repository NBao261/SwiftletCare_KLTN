import { useState, useEffect, FormEvent } from 'react'
import { useCreateUser, type AdminCreatableRole } from '@/hooks/admin/useUsers'
import { PASSWORD_MIN, parseRegions, validateNewUser, type Field, type FormState } from '@/validations/admin/user.validation'
import { useFarms } from '@/hooks/shared/useFarms'
import { Button, Input, Modal, ModalHeader, MODAL_SECTION_TITLE } from '@/components/ui'
import ComingSoon from '@/components/ui/ComingSoon'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { ROLE_LABEL } from '@/components/features/admin/users/users.constants'

const CREATABLE_ROLES: AdminCreatableRole[] = ['TECHNICIAN', 'SALES_STAFF']
/**
 * Vai trò Sales Staff đã đổi thành chuyên viên (Staff) nhưng backend chưa đổi role/endpoint — tạm hiện "Sắp ra mắt"
 * thay cho form. Bật lại (true) khi backend xong; phần form chuyên viên bên dưới vẫn giữ nguyên.
 */
const STAFF_FORM_READY = false
const EMPTY_FORM: FormState ={ role: 'TECHNICIAN', full_name: '', email: '', phone: '', password: '', regions: '', farmIds: [] }

/**
 * AUTH-FR-005c, Flow 16 bước 1a — 1 modal cho cả 2 loại tài khoản Admin được
 * tạo (RACI mục 4.4: không tạo Farm Owner, Admin là tài khoản gốc seed):
 * - Technician → POST /admin/technicians, bắt buộc `assigned_regions`
 * - Sales Staff → POST /admin/sales-staff, bắt buộc `farm_ids` (≥1 farm đang tồn tại)
 * Admin tự đặt mật khẩu ban đầu (backend không tự sinh/gửi mail ở 2 endpoint này).
 * Lỗi chỉ hiện sau khi người dùng rời ô (blur) hoặc đã bấm submit — không đỏ cả form lúc mới mở.
 * `presetFarmId`: mở từ trang chi tiết Farm → KHOÁ vai trò ở Sales Staff + tích sẵn farm đó.
 * Khoá chứ không chỉ chọn sẵn: Technician gắn với `assigned_regions` chứ không gắn farm nào,
 * đổi vai trò ở màn này sẽ làm rơi farm đang mở khỏi payload mà không báo gì.
 */
export default function CreateUserModal({ open, onClose, presetFarmId }: { open: boolean; onClose: () => void; presetFarmId?: string }) {
  const createUser = useCreateUser()
  const { data: farms, isLoading: farmsLoading } = useFarms()
  const push = useToastStore(s => s.push)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)

  // Modal không unmount giữa các lần mở (chỉ toggle `open`) — reset form mỗi lần mở lại.
  useEffect(() => {
    if (!open) return
    setForm(presetFarmId ? { ...EMPTY_FORM, role: 'SALES_STAFF', farmIds: [presetFarmId] } : EMPTY_FORM)
    setTouched({})
    setSubmitted(false)
  }, [open, presetFarmId])

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
    if (form.role === 'SALES_STAFF' && !STAFF_FORM_READY) return
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
        onSuccess: () => { push(t('Đã tạo tài khoản {{role}}', { role: ROLE_LABEL[form.role] })); onClose() },
        // 409 "Email đã được đăng ký" / 404 farm không tồn tại... — backend trả message tiếng Việt sẵn
        onError: (err) => push(getApiErrorMessage(err, 'Tạo tài khoản thất bại'), 'error'),
      },
    )
  }

  const presetFarmName = presetFarmId ? farms?.find(f => f._id === presetFarmId)?.name : undefined
  const staffSoon = form.role === 'SALES_STAFF' && !STAFF_FORM_READY
  const title = presetFarmId
    ? (presetFarmName ? t('Tạo chuyên viên cho {{farm}}', { farm: presetFarmName }) : t('Tạo chuyên viên'))
    : t('Tạo tài khoản')
  // Mở từ chi tiết Farm → khoá vai trò ở chuyên viên (xem JSDoc): chỉ hiện đúng 1 mục
  const roles = presetFarmId ? (['SALES_STAFF'] as AdminCreatableRole[]) : CREATABLE_ROLES

  return (
    // Bố cục ngang như các popup Admin: tiêu đề + thanh ngăn, dưới là 2 cột (trái = vai trò, phải = form theo nhóm).
    // Thân cao cố định (h-[27rem]) nên đổi vai trò / lỗi hiện-ẩn không làm popup co giãn; form dài thì cuộn trong khung.
    <Modal open={open} onClose={onClose} size="xl" ariaLabel={title}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title={title} description="Chọn vai trò và điền thông tin tài khoản" />

        <div className="flex h-[27rem] gap-6">
        {/* Cột trái: vai trò — đang chọn nền đen chữ trắng như popup Tạo ticket */}
        <div className="flex w-52 shrink-0 flex-col border-r border-gray-200 pr-5">
          <h3 className={MODAL_SECTION_TITLE}>{t('Vai trò')}</h3>
          <div className="flex flex-col gap-0.5" role="radiogroup" aria-label={t('Vai trò')}>
            {roles.map(r => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={form.role === r}
                onClick={() => set('role', r)}
                className={cn(
                  'rounded-xl px-3 py-2 text-left text-body transition-colors duration-150',
                  form.role === r ? 'bg-charcoal font-semibold text-white' : 'text-graphite hover:bg-gray-100',
                )}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Cột phải: nội dung cuộn (nếu dài) + nút */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">

          {staffSoon ? (
            <div className="min-h-0 flex-1 [&>div]:h-full">
              <ComingSoon
                title="Sắp ra mắt"
                note="Tạo tài khoản chuyên viên đang chờ backend cập nhật vai trò mới. Hiện chỉ tạo được kỹ thuật viên."
              />
            </div>
          ) : (
          <>
          {/* Lỗi ngắn hiện ngay dưới ô nhập */}
          {/* pr-4: thanh cuộn cách khối nội dung 1 khoảng, không dính sát viền ô */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-4">
          <section>
            <h4 className={MODAL_SECTION_TITLE}>{t('Đăng nhập & liên hệ')}</h4>
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
          </section>

          <section>
            <h4 className={MODAL_SECTION_TITLE}>{t('Phân công')}</h4>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        {form.role === 'TECHNICIAN' && (
          <Input
            label="Vùng phụ trách"
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
              {t('Farm phụ trách')}<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
            </span>
            {farmsLoading && <p className="text-sm text-warmGray">{t('Đang tải danh sách farm...')}</p>}
            {!farmsLoading && !farms?.length && (
              <p className="text-sm text-warmGray">{t('Chưa có farm nào trong hệ thống để gán.')}</p>
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
            {/* Lỗi ngắn dưới danh sách — như Input */}
            {showError('farmIds') && <span className="text-xs text-alertRed">{errors.farmIds}</span>}
          </div>
        )}

            </div>
          </section>
          </div>

          <div className="flex shrink-0 justify-end">
            <Button type="submit" loading={createUser.isPending}>Tạo tài khoản</Button>
          </div>
          </>
          )}
        </div>
        </div>
      </form>
    </Modal>
  )
}
