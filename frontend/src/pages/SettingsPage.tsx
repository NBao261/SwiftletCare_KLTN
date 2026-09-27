// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Trang dùng chung MỌI role (/settings).
// Đổi: chỉ giao diện — theo khuôn các trang Admin (card trắng, đầu card = ô icon charcoal + tiêu đề text-h2 +
// dòng phụ). Bỏ <h1> "Cài đặt tài khoản" (AppHeader đã hiện tên trang); vai trò hiện nhãn tiếng Việt (ROLE_LABEL)
// thay mã "ADMIN"; nút Đăng xuất chuyển lên card hồ sơ; 2 cột trên desktop. Logic/API/hook giữ nguyên.
import { useState, useEffect, FormEvent, type ReactNode } from 'react'
import {
  BellIcon, ChatCircleTextIcon, DeviceMobileIcon, EnvelopeIcon, MoonIcon, PhoneIcon,
  ShieldCheckIcon, SignOutIcon, TrashIcon, type Icon,
} from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { Button, Input, Toggle } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/constants/roles'

/** Settings Page — hồ sơ, thông báo (ALERT-FR-005/006), bảo mật (AUTH-FR-009), xoá tài khoản (AUTH-FR-012) */
export default function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()

  if (!user) return null

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hồ sơ: avatar + tên + vai trò, email/SĐT, đăng xuất ── */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-charcoal text-2xl font-bold text-limeMist">
            {user.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-h2 text-charcoal">{user.full_name}</p>
            <span className="mt-1 inline-block rounded-full bg-accent-300 px-2.5 py-0.5 text-caption text-charcoal">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <InfoItem icon={EnvelopeIcon} label="Email" value={user.email} />
          <InfoItem icon={PhoneIcon} label="Số điện thoại" value={user.phone || '--'} />
        </dl>

        <Button variant="danger" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
          <SignOutIcon size={14} weight="bold" />
          Đăng xuất
        </Button>
      </section>

      {/* ── 2 cột: Thông báo | Bảo mật + Dữ liệu tài khoản ── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <NotificationPreferencesCard />
        <div className="flex flex-col gap-4">
          <SecurityCard />
          <DeletionCard />
        </div>
      </div>
    </div>
  )
}

function InfoItem({ icon: ItemIcon, label, value }: { icon: Icon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
        <ItemIcon size={16} weight="bold" />
      </span>
      <div className="min-w-0">
        <dt className="label-caption">{label}</dt>
        <dd className="truncate text-body font-medium text-charcoal">{value}</dd>
      </div>
    </div>
  )
}

/** Khung card + đầu card (ô icon charcoal · tiêu đề text-h2 · dòng phụ) — cùng khuôn card trang Ticket của Admin */
function SettingsCard({ icon: HeaderIcon, title, subtitle, danger, children }: {
  icon: Icon; title: string; subtitle: string; danger?: boolean; children: ReactNode
}) {
  return (
    <section className={cn('rounded-2xl border bg-white p-5 shadow-card', danger ? 'border-alertRed/30' : 'border-warmGray/15')}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-red-100 text-alertRed' : 'bg-charcoal text-limeMist')}>
          <HeaderIcon size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">{title}</h2>
          <p className="text-small text-graphite">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

// ── Thông báo (ALERT-FR-005/006) ────────────────────────────────────────────

function NotificationPreferencesCard() {
  const user = useAuthStore(s => s.user)
  const { updateNotificationPreferences } = useAuth()
  const push = useToastStore(s => s.push)
  const prefs = user?.notification_preferences

  const [push_, setPush] = useState(prefs?.push ?? true)
  const [zalo, setZalo] = useState(prefs?.zalo ?? false)
  const [sms, setSms] = useState(prefs?.sms ?? false)
  const [quietStart, setQuietStart] = useState(prefs?.quiet_hours?.start ?? '')
  const [quietEnd, setQuietEnd] = useState(prefs?.quiet_hours?.end ?? '')

  // user (và prefs) có thể đổi từ nơi khác (tab khác, refetch) trong lúc trang
  // này đang mở — resync lại form thay vì chỉ seed 1 lần lúc mount.
  useEffect(() => {
    setPush(prefs?.push ?? true)
    setZalo(prefs?.zalo ?? false)
    setSms(prefs?.sms ?? false)
    setQuietStart(prefs?.quiet_hours?.start ?? '')
    setQuietEnd(prefs?.quiet_hours?.end ?? '')
  }, [prefs])

  function handleSave() {
    updateNotificationPreferences.mutate(
      { push: push_, zalo, sms, quiet_hours: { start: quietStart, end: quietEnd } },
      {
        onSuccess: () => push('Đã lưu cài đặt thông báo'),
        onError: (err) => push(getApiErrorMessage(err, 'Lưu thất bại'), 'error'),
      },
    )
  }

  return (
    <SettingsCard icon={BellIcon} title="Thông báo" subtitle="Kênh nhận cảnh báo và giờ im lặng">
      <div className="flex flex-col gap-2">
        <ToggleRow icon={BellIcon} label="Push notification" description="Thông báo trên trình duyệt/ứng dụng" checked={push_} onChange={setPush} />
        <ToggleRow icon={ChatCircleTextIcon} label="Zalo ZNS" description="Cảnh báo CRITICAL/HIGH" checked={zalo} onChange={setZalo} />
        <ToggleRow icon={DeviceMobileIcon} label="SMS dự phòng" description="Chỉ cảnh báo CRITICAL" checked={sms} onChange={setSms} />
      </div>

      <div className="mt-4 border-t border-warmGray/10 pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-body font-semibold text-charcoal">
          <MoonIcon size={16} weight="bold" />
          Giờ im lặng
          <span className="text-small font-normal text-warmGray">— không nhận thông báo, trừ CRITICAL</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Từ" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)} />
          <Input label="Đến" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} />
        </div>
      </div>

      <Button className="mt-4 w-full" loading={updateNotificationPreferences.isPending} onClick={handleSave}>
        Lưu cài đặt
      </Button>
    </SettingsCard>
  )
}

function ToggleRow({ icon: RowIcon, label, description, checked, onChange }: {
  icon: Icon; label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', checked ? 'bg-limeMist/60' : 'bg-warmGray/5')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-charcoal shadow-icon">
        <RowIcon size={16} weight="bold" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-charcoal">{label}</p>
        <p className="text-small text-warmGray">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={label} />
    </div>
  )
}

// ── Bảo mật — đổi mật khẩu qua luồng quên mật khẩu (AUTH-FR-009) ────────────

function SecurityCard() {
  const { forgotPassword, resetPassword } = useAuth()
  const user = useAuthStore(s => s.user)
  const push = useToastStore(s => s.push)
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')

  function handleSend() {
    if (!user?.email) return
    forgotPassword.mutate(user.email, {
      onSuccess: () => { setSent(true); push('Đã gửi mã đặt lại (xem console log backend ở dev)') },
    })
  }

  function handleReset(e: FormEvent) {
    e.preventDefault()
    if (!user?.email) return
    resetPassword.mutate({ email: user.email, token, newPassword }, {
      onSuccess: () => { push('Đã đổi mật khẩu — vui lòng đăng nhập lại ở các thiết bị khác'); setSent(false); setToken(''); setNewPassword('') },
      onError: (err) => push(getApiErrorMessage(err, 'Đặt lại mật khẩu thất bại'), 'error'),
    })
  }

  return (
    <SettingsCard icon={ShieldCheckIcon} title="Bảo mật" subtitle="Đổi mật khẩu bằng mã gửi về email hiện tại">
      {!sent ? (
        <Button variant="secondary" className="w-full" loading={forgotPassword.isPending} onClick={handleSend}>
          Gửi mã đặt lại mật khẩu
        </Button>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <p className="rounded-xl bg-limeMist/60 px-3.5 py-2.5 text-small text-charcoal">
            Đã gửi mã 6 số tới <span className="font-semibold">{user?.email}</span>.
          </p>
          <Input label="Mã đặt lại (6 số)" required value={token} onChange={e => setToken(e.target.value)} maxLength={6} />
          <Input label="Mật khẩu mới" type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Button type="submit" loading={resetPassword.isPending} className="w-full">Đổi mật khẩu</Button>
        </form>
      )}
    </SettingsCard>
  )
}

// ── Dữ liệu tài khoản (AUTH-FR-012) ─────────────────────────────────────────

function DeletionCard() {
  const user = useAuthStore(s => s.user)
  const { requestDeletion } = useAuth()
  const push = useToastStore(s => s.push)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleConfirm() {
    requestDeletion.mutate(undefined, {
      onSuccess: () => { push('Đã gửi yêu cầu xoá tài khoản'); setShowConfirm(false) },
      onError: (err) => push(getApiErrorMessage(err, 'Gửi yêu cầu thất bại'), 'error'),
    })
  }

  return (
    // Vùng nguy hiểm: viền + ô icon đỏ nhạt để tách khỏi các card cài đặt thường
    <SettingsCard icon={TrashIcon} title="Dữ liệu tài khoản" subtitle="Yêu cầu xoá tài khoản theo Nghị định 13/2023/NĐ-CP" danger>
      {user?.deletion_requested_at ? (
        <p className="rounded-xl bg-warmGray/10 px-4 py-3 text-body text-charcoal">
          Đã gửi yêu cầu xoá tài khoản ngày {formatDate(user.deletion_requested_at)} — Administrator sẽ xử lý trong tối đa 30 ngày.
        </p>
      ) : (
        <Button variant="danger" className="w-full" onClick={() => setShowConfirm(true)}>Yêu cầu xoá tài khoản</Button>
      )}

      <ConfirmModal
        open={showConfirm} title="Yêu cầu xoá tài khoản?" danger
        description="Administrator sẽ xử lý yêu cầu trong tối đa 30 ngày. Nếu bạn là Primary Owner của farm còn thành viên khác, quyền sở hữu sẽ được chuyển tự động."
        loading={requestDeletion.isPending}
        onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)}
      />
    </SettingsCard>
  )
}
