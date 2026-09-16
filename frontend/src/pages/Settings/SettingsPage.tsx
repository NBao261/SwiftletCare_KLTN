import { useState, useEffect, FormEvent } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, Button, Input, Toggle } from '@/components/ui'
import ConfirmModal from '@/components/common/ConfirmModal'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'

/** Settings Page — hồ sơ, thông báo (ALERT-FR-005/006), bảo mật (AUTH-FR-009), xoá tài khoản (AUTH-FR-012) */
export default function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-charcoal">Cài đặt tài khoản</h1>

      <Card size="lg" className="max-w-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal text-2xl font-bold text-white">
            {user.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="text-lg font-bold text-charcoal">{user.full_name}</p>
            <Badge tone="info">{user.role}</Badge>
          </div>
        </div>

        <dl className="mt-6 space-y-3 border-t border-warmGray/15 pt-4">
          <Row label="Email" value={user.email} />
          <Row label="Số điện thoại" value={user.phone || '--'} />
        </dl>
      </Card>

      <NotificationPreferencesCard />
      <SecurityCard />
      <DeletionCard />

      <Button variant="danger" className="max-w-lg w-full" onClick={() => logout.mutate()}>
        Đăng xuất
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-warmGray">{label}</dt>
      <dd className="font-medium text-charcoal">{value}</dd>
    </div>
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
    <Card size="lg" className="max-w-lg">
      <h2 className="mb-4 font-bold text-charcoal">Thông báo</h2>
      <div className="flex flex-col gap-3">
        <ToggleRow label="Push notification" checked={push_} onChange={setPush} />
        <ToggleRow label="Zalo ZNS (cảnh báo CRITICAL/HIGH)" checked={zalo} onChange={setZalo} />
        <ToggleRow label="SMS dự phòng (chỉ CRITICAL)" checked={sms} onChange={setSms} />
      </div>

      <div className="mt-4 border-t border-warmGray/15 pt-4">
        <p className="label-caption mb-2">Giờ im lặng (không nhận thông báo, trừ CRITICAL)</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Từ" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)} />
          <Input label="Đến" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} />
        </div>
      </div>

      <Button className="mt-4 w-full" loading={updateNotificationPreferences.isPending} onClick={handleSave}>
        Lưu cài đặt
      </Button>
    </Card>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-charcoal">{label}</span>
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
    <Card size="lg" className="max-w-lg">
      <h2 className="mb-1 font-bold text-charcoal">Bảo mật</h2>
      <p className="mb-4 text-sm text-warmGray">Đổi mật khẩu bằng mã gửi về email hiện tại.</p>

      {!sent ? (
        <Button variant="secondary" loading={forgotPassword.isPending} onClick={handleSend}>
          Gửi mã đặt lại mật khẩu
        </Button>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <Input label="Mã đặt lại (6 số)" required value={token} onChange={e => setToken(e.target.value)} maxLength={6} />
          <Input label="Mật khẩu mới" type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Button type="submit" loading={resetPassword.isPending} className="w-full">Đổi mật khẩu</Button>
        </form>
      )}
    </Card>
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
    <Card size="lg" className="max-w-lg">
      <h2 className="mb-1 font-bold text-charcoal">Dữ liệu tài khoản</h2>

      {user?.deletion_requested_at ? (
        <p className="rounded-xl bg-warmGray/10 px-4 py-3 text-sm text-charcoal">
          Đã gửi yêu cầu xoá tài khoản ngày {formatDate(user.deletion_requested_at)} — Administrator sẽ xử lý trong tối đa 30 ngày.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-warmGray">
            Bạn có thể yêu cầu xoá tài khoản và dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.
          </p>
          <Button variant="danger" onClick={() => setShowConfirm(true)}>Yêu cầu xoá tài khoản</Button>
        </>
      )}

      <ConfirmModal
        open={showConfirm} title="Yêu cầu xoá tài khoản?" danger
        description="Administrator sẽ xử lý yêu cầu trong tối đa 30 ngày. Nếu bạn là Primary Owner của farm còn thành viên khác, quyền sở hữu sẽ được chuyển tự động."
        loading={requestDeletion.isPending}
        onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)}
      />
    </Card>
  )
}
