// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Trang dùng chung MỌI role (/settings).
// Đổi: chỉ giao diện — theo khuôn các trang Admin (card trắng, đầu card = ô icon charcoal + tiêu đề text-h2 +
// dòng phụ). Bỏ <h1> "Cài đặt tài khoản" (AppHeader đã hiện tên trang); vai trò hiện nhãn tiếng Việt (ROLE_LABEL)
// thay mã "ADMIN"; nút Đăng xuất chuyển lên card hồ sơ; 2 cột trên desktop. Logic/API/hook giữ nguyên.
import { useState, useEffect, FormEvent, type ReactNode } from 'react'
import {
  BellIcon, EnvelopeIcon, MoonIcon, PhoneIcon,
  ShieldCheckIcon, TelegramLogoIcon, TrashIcon, type Icon,
} from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { usePermission } from '@/hooks/common/usePermission'
import { Avatar, Button, Input, Toggle } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import { formatHourMinute } from '@/lib/i18n'
import { qrDataUrl } from '@/lib/qrCode'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/constants/roles'
import { t } from '@/i18n'
import { LEVELS } from '@/constants/severity'
import { levelDict } from '@/constants/severity.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import {
  applyGeneralPush, bySeverityPayload, levelChannelsOf, urgentHasOutsideChannel, type LevelChannels,
} from '@/validations/common/notificationChannels.validation'
import type { SeverityLevel } from '@/types'

// Cài đặt: hồ sơ, thông báo và Telegram (ALERT-FR-005, 006, 013; không có với Admin), bảo mật (AUTH-FR-009), xoá tài khoản (AUTH-FR-012)
export default function SettingsPage() {
  const user = useAuthStore(s => s.user)
  // ALERT-FR-005, 006, 013 — kênh thông báo và Telegram của người nhận cảnh báo; Admin không có (Report 3 §2.4)
  const hasNotificationSettings = usePermission('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN')

  if (!user) return null

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hồ sơ: avatar + tên + vai trò, email/SĐT ── */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={user.full_name} size="lg" />
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
      </section>

      {/* ── 2 cột: Thông báo | Bảo mật + Telegram + Dữ liệu tài khoản (Admin: chỉ Bảo mật + Dữ liệu tài khoản) ── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {hasNotificationSettings && <NotificationPreferencesCard />}
        <div className="flex flex-col gap-4">
          <SecurityCard />
          {hasNotificationSettings && <TelegramCard />}
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
        <dt className="label-caption">{t(label)}</dt>
        <dd className="truncate text-body font-medium text-charcoal">{value}</dd>
      </div>
    </div>
  )
}

/** Khung card + đầu card (ô icon charcoal · tiêu đề text-h2 · dòng phụ) */
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
          <h2 className="text-h2 text-charcoal">{t(title)}</h2>
          <p className="text-small text-graphite">{t(subtitle)}</p>
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

  const telegramLinked = user?.telegram_linked ?? false
  // Nhãn 3 cấp dùng chung (FE_Design 6.3); lỗi API theo nhóm, không hiện câu thô của backend (13.16)
  const { t: levelLabel } = useTranslation(levelDict)
  const apiErrorMessage = useApiErrorMessage()

  const [push_, setPush] = useState(prefs?.push ?? true)
  // zalo/sms đã bỏ theo SRS 3.1.0 (G-01) — chỉ còn kênh push
  const [quietStart, setQuietStart] = useState(prefs?.quiet_hours?.start ?? '')
  const [quietEnd, setQuietEnd] = useState(prefs?.quiet_hours?.end ?? '')
  // ALERT-FR-005 — kênh ngoài ứng dụng theo cấp cảnh báo
  const [levels, setLevels] = useState(() => levelChannelsOf(prefs))
  const urgentOk = urgentHasOutsideChannel(levels.P1, telegramLinked)
  const setLevelChannel = (level: SeverityLevel, channel: keyof LevelChannels, value: boolean) =>
    setLevels(current => ({ ...current, [level]: { ...current[level], [channel]: value } }))
  // Push chung cũng là push của các cấp cảnh báo: đổi nó thì cả 3 cấp đổi theo
  const changeGeneralPush = (value: boolean) => {
    setPush(value)
    setLevels(current => applyGeneralPush(current, value))
  }

  // user (và prefs) có thể đổi từ nơi khác (tab khác, refetch) trong lúc trang
  // này đang mở — resync lại form thay vì chỉ seed 1 lần lúc mount.
  useEffect(() => {
    setPush(prefs?.push ?? true)
    setQuietStart(prefs?.quiet_hours?.start ?? '')
    setQuietEnd(prefs?.quiet_hours?.end ?? '')
    setLevels(levelChannelsOf(prefs))
  }, [prefs])

  function handleSave() {
    const general = { push: push_, telegram: prefs?.telegram ?? true }
    updateNotificationPreferences.mutate(
      { push: push_, by_severity: bySeverityPayload(levels, general), quiet_hours: { start: quietStart, end: quietEnd } },
      {
        onSuccess: () => push('Đã lưu cài đặt thông báo'),
        onError: (err) => push(apiErrorMessage(err, t('Lưu thất bại')), 'error'),
      },
    )
  }

  return (
    <SettingsCard icon={BellIcon} title="Thông báo" subtitle="Kênh nhận cảnh báo và giờ im lặng">
      <div className="flex flex-col gap-2">
        <ToggleRow icon={BellIcon} label="Push notification" description="Thông báo trên trình duyệt/ứng dụng" checked={push_} onChange={changeGeneralPush} />
        {/* Zalo ZNS và SMS đã bỏ theo SRS 3.1.0 (G-01) */}
      </div>

      {/* ALERT-FR-005 — kênh theo cấp cảnh báo; Telegram chỉ hiện khi đã liên kết bot */}
      <div className="mt-4 border-t border-warmGray/10 pt-4">
        <p className="mb-2 text-body font-semibold text-charcoal">{t('Kênh theo mức cảnh báo')}</p>
        <div className="flex flex-col gap-2">
          {LEVELS.map(level => (
            <div key={level} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-warmGray/5 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-body font-semibold text-charcoal">{levelLabel(level)}</span>
              <label className="flex items-center gap-2 text-small text-warmGray">
                {t('Push')}
                <Toggle checked={levels[level].push} onChange={value => setLevelChannel(level, 'push', value)} aria-label={`${levelLabel(level)} — ${t('Push')}`} />
              </label>
              {telegramLinked && (
                <label className="flex items-center gap-2 text-small text-warmGray">
                  {t('Telegram')}
                  <Toggle checked={levels[level].telegram} onChange={value => setLevelChannel(level, 'telegram', value)} aria-label={`${levelLabel(level)} — ${t('Telegram')}`} />
                </label>
              )}
            </div>
          ))}
        </div>
        <p className={cn('mt-2 text-small', urgentOk ? 'text-warmGray' : 'text-safetyOrange')}>
          {t('Cảnh báo Khẩn cấp phải còn ít nhất một kênh ngoài ứng dụng. Cảnh báo mọi mức vẫn luôn hiện trong ứng dụng.')}
        </p>
      </div>

      <div className="mt-4 border-t border-warmGray/10 pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-body font-semibold text-charcoal">
          <MoonIcon size={16} weight="bold" />
          {t('Giờ im lặng')}
          <span className="text-small font-normal text-warmGray">{t('— không nhận thông báo, trừ CRITICAL')}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Từ" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)} />
          <Input label="Đến" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} />
        </div>
      </div>

      <Button className="mt-4 w-full" disabled={!urgentOk} loading={updateNotificationPreferences.isPending} onClick={handleSave}>
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
        <p className="text-body font-semibold text-charcoal">{t(label)}</p>
        <p className="text-small text-warmGray">{t(description)}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={t(label)} />
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
            {t('Đã gửi mã 6 số tới')} <span className="font-semibold">{user?.email}</span>.
          </p>
          <Input label="Mã đặt lại (6 số)" required value={token} onChange={e => setToken(e.target.value)} maxLength={6} />
          <Input label="Mật khẩu mới" type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Button type="submit" loading={resetPassword.isPending} className="w-full">Đổi mật khẩu</Button>
        </form>
      )}
    </SettingsCard>
  )
}

// ── Telegram (ALERT-FR-013, SF-04) ──────────────────────────────────────────

function TelegramCard() {
  const user = useAuthStore(s => s.user)
  const { createTelegramLink, checkTelegramLink, unlinkTelegram } = useAuth()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [link, setLink] = useState<{ deep_link: string; expires_at: string } | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [showUnlink, setShowUnlink] = useState(false)
  const linked = user?.telegram_linked ?? false
  // Push của mức Khẩn cấp đã tắt thì Telegram là kênh ngoài ứng dụng duy nhất: backend từ chối gỡ (ALERT-FR-005)
  const urgentPushOff = !levelChannelsOf(user?.notification_preferences).P1.push

  function handleCreate() {
    createTelegramLink.mutate(undefined, {
      onSuccess: (created) => {
        setLink(created)
        void qrDataUrl(created.deep_link).then(setQrImage)
      },
      onError: (err) => push(apiErrorMessage(err, t('Không tạo được liên kết Telegram')), 'error'),
    })
  }

  // Liên kết xảy ra trong Telegram (bấm Start) nên đọc lại tài khoản để biết đã xong chưa
  function handleCheck() {
    checkTelegramLink.mutate(undefined, {
      onSuccess: () => {
        if (useAuthStore.getState().user?.telegram_linked) {
          push('Đã liên kết Telegram')
          setLink(null)
          setQrImage(null)
        } else {
          push('Chưa thấy liên kết — hãy bấm Start trong Telegram rồi kiểm tra lại', 'error')
        }
      },
      onError: (err) => push(apiErrorMessage(err), 'error'),
    })
  }

  function handleUnlink() {
    unlinkTelegram.mutate(undefined, {
      onSuccess: () => { push('Đã gỡ liên kết Telegram'); setShowUnlink(false) },
      onError: (err) => { push(apiErrorMessage(err, t('Gỡ liên kết thất bại')), 'error'); setShowUnlink(false) },
    })
  }

  return (
    <SettingsCard icon={TelegramLogoIcon} title="Telegram" subtitle="Nhận cảnh báo qua bot Telegram của hệ thống">
      {linked ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-accent-600/20 px-4 py-3 text-body text-charcoal">{t('Tài khoản đã liên kết Telegram.')}</p>
          <Button variant="secondary" className="w-full" onClick={() => setShowUnlink(true)}>{t('Gỡ liên kết')}</Button>
        </div>
      ) : link ? (
        <div className="flex flex-col items-center gap-3">
          {qrImage && <img src={qrImage} alt={t('Mã QR liên kết Telegram')} className="h-40 w-40 rounded-xl border border-warmGray/15" />}
          <p className="text-center text-small text-graphite">
            {t('Quét mã hoặc mở liên kết, bấm Start trong Telegram, rồi bấm "Tôi đã bấm Start". Liên kết hết hạn lúc {{time}}.', { time: formatHourMinute(link.expires_at) })}
          </p>
          <a href={link.deep_link} target="_blank" rel="noopener noreferrer" className="text-body font-semibold text-charcoal underline">
            {t('Mở Telegram')}
          </a>
          <Button className="w-full" loading={checkTelegramLink.isPending} onClick={handleCheck}>{t('Tôi đã bấm Start')}</Button>
        </div>
      ) : (
        <Button className="w-full" loading={createTelegramLink.isPending} onClick={handleCreate}>{t('Liên kết Telegram')}</Button>
      )}

      <ConfirmModal
        open={showUnlink} title="Gỡ liên kết Telegram?" danger
        description={urgentPushOff
          ? 'Push của cảnh báo Khẩn cấp đang tắt: gỡ Telegram thì cảnh báo Khẩn cấp không còn kênh ngoài ứng dụng nào, nên hệ thống sẽ từ chối. Hãy bật push cho mức Khẩn cấp trước.'
          : 'Bạn sẽ không nhận cảnh báo qua Telegram nữa cho tới khi liên kết lại.'}
        loading={unlinkTelegram.isPending}
        onConfirm={handleUnlink} onCancel={() => setShowUnlink(false)}
      />
    </SettingsCard>
  )
}

// ── Dữ liệu tài khoản (AUTH-FR-012) ─────────────────────────────────────────

// AUTH-FR-012 — Administrator xử lý trong 30 ngày kể từ lúc gửi
const DELETION_DEADLINE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function DeletionCard() {
  const user = useAuthStore(s => s.user)
  const { requestDeletion, cancelDeletion } = useAuth()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [showConfirm, setShowConfirm] = useState(false)

  // Report 3 §6.14 — DELETION_REQUESTED → ACTIVE khi người dùng huỷ, trước khi Administrator xử lý
  function handleCancel() {
    cancelDeletion.mutate(undefined, {
      onSuccess: () => push('Đã huỷ yêu cầu xoá tài khoản'),
      onError: (err) => push(apiErrorMessage(err, t('Huỷ yêu cầu thất bại')), 'error'),
    })
  }

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
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-warmGray/10 px-4 py-3 text-body text-charcoal">
            {t('Đã gửi yêu cầu xoá tài khoản ngày {{date}}, hạn xử lý {{deadline}} — Administrator sẽ xử lý trong tối đa 30 ngày.', {
              date: formatDate(user.deletion_requested_at),
              deadline: formatDate(new Date(new Date(user.deletion_requested_at).getTime() + DELETION_DEADLINE_DAYS * DAY_MS).toISOString()),
            })}
          </p>
          <Button variant="secondary" className="w-full" loading={cancelDeletion.isPending} onClick={handleCancel}>
            {t('Huỷ yêu cầu xoá')}
          </Button>
        </div>
      ) : (
        // context 'button': EN dịch dạng động từ ("Request…"), khác nhãn tab "Yêu cầu xoá tài khoản" ở trang Admin
        <Button variant="danger" className="w-full" onClick={() => setShowConfirm(true)}>{t('Yêu cầu xoá tài khoản', { context: 'button' })}</Button>
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
