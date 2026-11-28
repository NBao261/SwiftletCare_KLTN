import { useState, useEffect, FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BellIcon, EnvelopeIcon, MoonIcon, PhoneIcon, ShieldCheckIcon, ShieldIcon,
  TelegramLogoIcon, TrashIcon, type Icon,
} from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { usePermission } from '@/hooks/common/usePermission'
import { Avatar, Button, Input, TimePicker, Toggle } from '@/components/ui'
import StatusTabs from '@/components/common/StatusTabs'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/lib/helpers'
import { formatHourMinute } from '@/lib/i18n'
import { qrDataUrl } from '@/lib/qrCode'
import { cn } from '@/lib/cn'
import { ROLE_LABEL } from '@/constants/roles'
import { NO_VALUE } from '@/constants/display'
import { t } from '@/i18n'
import { LEVELS } from '@/constants/severity'
import { levelDict } from '@/constants/severity.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import {
  bySeverityPayload, levelChannelsOf, urgentHasOutsideChannel, type LevelChannels,
} from '@/validations/common/notificationChannels.validation'
import type { SeverityLevel } from '@/types'
import { PASSWORD_MAX_LENGTH, validatePasswordReset } from '@/validations/common/passwordChange.validation'

// Ba nhóm: Tài khoản (hồ sơ, mật khẩu), Thông báo (kênh nhận), Quyền riêng tư và dữ liệu (chính sách, xoá tài khoản)
const TABS = ['account', 'notifications', 'privacy'] as const
type SettingsTab = typeof TABS[number]

const TAB_LABEL: Record<SettingsTab, string> = {
  account: 'Tài khoản',
  notifications: 'Thông báo',
  privacy: 'Quyền riêng tư và dữ liệu',
}

// Cài đặt theo role (todo-ui-layout-1120)
export default function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const isAlertRecipient = usePermission('FARM_OWNER', 'FARM_TECHNICIAN')
  const isFarmOwner = usePermission('FARM_OWNER')
  // Tab nằm trên URL (?tab=notifications) để chuông và menu mở thẳng đúng nhóm
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: SettingsTab = TABS.find(value => value === searchParams.get('tab')) ?? 'account'
  const setTab = (value: SettingsTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    if (value === 'account') next.delete('tab')
    else next.set('tab', value)
    return next
  }, { replace: true })

  if (!user) return null

  return (
    <div className="flex w-full max-w-4xl flex-col gap-5">
      <StatusTabs
        ariaLabel={t('Nhóm cài đặt')}
        value={tab}
        onChange={setTab}
        tabs={TABS.map(id => ({ id, label: t(TAB_LABEL[id]) }))}
      />

      {tab === 'account' && (
        <>
          <ProfileCard />
          <SecurityCard />
        </>
      )}

      {tab === 'notifications' && (
        isAlertRecipient ? (
          <>
            <AlertChannelsCard />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {isFarmOwner && <QuietHoursCard />}
              <TelegramCard />
            </div>
          </>
        ) : <InAppOnlyCard />
      )}

      {tab === 'privacy' && (
        <>
          <PolicyCard />
          <DeletionCard />
        </>
      )}
    </div>
  )
}

// Hồ sơ: chỉ xem
function ProfileCard() {
  const user = useAuthStore(s => s.user)
  if (!user) return null
  return (
    <section className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar name={user.full_name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-h2 text-charcoal">{user.full_name}</p>
          <span className="mt-1 inline-block rounded-full bg-accent-300 px-2.5 py-0.5 text-small font-semibold text-charcoal">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <InfoItem icon={EnvelopeIcon} label="Email" value={user.email} />
        <InfoItem icon={PhoneIcon} label="Số điện thoại" value={user.phone || NO_VALUE} />
      </dl>
    </section>
  )
}

// Vai trò không nhận cảnh báo ra ngoài ứng dụng (Chuyên gia, Quản trị viên): thông báo chỉ nằm trong hộp thông báo
function InAppOnlyCard() {
  const navigate = useNavigate()
  return (
    <SettingsCard
      icon={BellIcon}
      title="Thông báo"
      subtitle="Thông báo của bạn hiện trong hộp thông báo của ứng dụng"
      action={<Button variant="secondary" size="sm" onClick={() => navigate('/notifications')}>{t('Mở hộp thông báo')}</Button>}
    />
  )
}

// Chính sách quyền riêng tư: nút mở trang chính sách trong khung ứng dụng
function PolicyCard() {
  const navigate = useNavigate()
  return (
    <SettingsCard
      icon={ShieldIcon}
      title="Chính sách quyền riêng tư"
      subtitle="Cách SwiftletCare thu thập và dùng dữ liệu của bạn"
      action={<Button variant="secondary" size="sm" onClick={() => navigate('/settings/privacy')}>{t('Đọc chính sách')}</Button>}
    />
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

// Khung card + đầu card (ô icon · tiêu đề text-h2 · dòng phụ 1 dòng · nút bên phải)
function SettingsCard({ icon: HeaderIcon, title, subtitle, danger, action, children }: {
  icon: Icon; title: string; subtitle: string; danger?: boolean; action?: ReactNode; children?: ReactNode
}) {
  return (
    <section className={cn('rounded-2xl border bg-white p-5 shadow-card', danger ? 'border-alertRed/30' : 'border-warmGray/15')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-red-100 text-alertRed' : 'bg-warmGray/10 text-charcoal')}>
          <HeaderIcon size={20} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-charcoal">{t(title)}</h2>
          <p className="text-body text-graphite">{t(subtitle)}</p>
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}

// Nút lưu của một khối: nút phụ, thành nút chính khi khối có thay đổi chưa lưu (ST-04)
function SaveButton({ dirty, disabled, loading, onClick, children }: {
  dirty: boolean; disabled?: boolean; loading: boolean; onClick: () => void; children: string
}) {
  return (
    <Button variant={dirty ? 'primary' : 'secondary'} size="sm" className="mt-4 self-end" disabled={!dirty || disabled} loading={loading} onClick={onClick}>
      {children}
    </Button>
  )
}

// Kênh cảnh báo theo mức: chỗ duy nhất bật/tắt thông báo đẩy (ST-02)
function AlertChannelsCard() {
  const user = useAuthStore(s => s.user)
  const { updateNotificationPreferences } = useAuth()
  const push = useToastStore(s => s.push)
  const prefs = user?.notification_preferences
  const telegramLinked = user?.telegram_linked ?? false
  // Nhãn 4 cấp dùng chung (FE_Design 6.3); lỗi API theo nhóm, không hiện câu thô của backend (13.16)
  const { t: levelLabel } = useTranslation(levelDict)
  const apiErrorMessage = useApiErrorMessage()

  const [levels, setLevels] = useState(() => levelChannelsOf(prefs))
  // user (và prefs) có thể đổi từ nơi khác (tab khác, refetch) trong lúc trang đang mở: đồng bộ lại form
  useEffect(() => setLevels(levelChannelsOf(prefs)), [prefs])
  const saved = levelChannelsOf(prefs)
  const dirty = LEVELS.some(level => levels[level].push !== saved[level].push || levels[level].telegram !== saved[level].telegram)
  const urgentOk = urgentHasOutsideChannel(levels.P1, telegramLinked)
  const setLevelChannel = (level: SeverityLevel, channel: keyof LevelChannels, value: boolean) =>
    setLevels(current => ({ ...current, [level]: { ...current[level], [channel]: value } }))

  function handleSave() {
    // Cờ push chung giữ nguyên (backend còn dùng cho thông báo không phải cảnh báo); mức khác cờ chung thì ghi đè
    const general = { push: prefs?.push ?? true, telegram: prefs?.telegram ?? true }
    updateNotificationPreferences.mutate(
      { by_severity: bySeverityPayload(levels, general) },
      {
        onSuccess: () => push('Đã lưu kênh cảnh báo'),
        onError: (err) => push(apiErrorMessage(err, t('Lưu thất bại')), 'error'),
      },
    )
  }

  return (
    <SettingsCard icon={BellIcon} title="Kênh cảnh báo" subtitle="Kênh ngoài ứng dụng theo từng mức. Cảnh báo luôn hiện trong ứng dụng.">
      <div className="flex flex-col">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-warmGray/15">
              <th scope="col" className="label-caption py-2 pr-4">{t('Mức')}</th>
              <th scope="col" className="label-caption w-28 py-2 text-center">{t('Thông báo đẩy')}</th>
              {telegramLinked && <th scope="col" className="label-caption w-28 py-2 text-center">{t('Telegram')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-warmGray/10">
            {LEVELS.map(level => (
              <tr key={level}>
                <th scope="row" className="py-3 pr-4 text-body font-semibold text-charcoal">{levelLabel(level)}</th>
                <td className="py-3 text-center">
                  <Toggle checked={levels[level].push} onChange={value => setLevelChannel(level, 'push', value)} aria-label={`${levelLabel(level)} · ${t('Thông báo đẩy')}`} />
                </td>
                {telegramLinked && (
                  <td className="py-3 text-center">
                    <Toggle checked={levels[level].telegram} onChange={value => setLevelChannel(level, 'telegram', value)} aria-label={`${levelLabel(level)} · ${t('Telegram')}`} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={cn('mt-2 text-small', urgentOk ? 'text-warmGray' : 'text-safetyOrange')}>
          {t('Mức Khẩn cấp phải còn ít nhất một kênh ngoài ứng dụng.')}
        </p>
        <SaveButton dirty={dirty} disabled={!urgentOk} loading={updateNotificationPreferences.isPending} onClick={handleSave}>
          {t('Lưu kênh cảnh báo')}
        </SaveButton>
      </div>
    </SettingsCard>
  )
}

// Giờ im lặng (chỉ chủ nhà yến): đồng hồ 24 giờ
function QuietHoursCard() {
  const user = useAuthStore(s => s.user)
  const { updateNotificationPreferences } = useAuth()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const savedStart = user?.notification_preferences?.quiet_hours?.start ?? ''
  const savedEnd = user?.notification_preferences?.quiet_hours?.end ?? ''
  const [quietStart, setQuietStart] = useState(savedStart)
  const [quietEnd, setQuietEnd] = useState(savedEnd)
  useEffect(() => { setQuietStart(savedStart); setQuietEnd(savedEnd) }, [savedStart, savedEnd])
  const dirty = quietStart !== savedStart || quietEnd !== savedEnd

  function handleSave() {
    updateNotificationPreferences.mutate(
      { quiet_hours: { start: quietStart, end: quietEnd } },
      {
        onSuccess: () => push('Đã lưu giờ im lặng'),
        onError: (err) => push(apiErrorMessage(err, t('Lưu thất bại')), 'error'),
      },
    )
  }

  return (
    <SettingsCard icon={MoonIcon} title="Giờ im lặng" subtitle="Trong giờ này chỉ cảnh báo Khẩn cấp được gửi ra ngoài ứng dụng">
      <div className="flex flex-col">
        <div className="grid grid-cols-2 gap-3">
          <TimePicker id="quiet-start" label="Từ" value={quietStart} onChange={setQuietStart} />
          <TimePicker id="quiet-end" label="Đến" value={quietEnd} onChange={setQuietEnd} />
        </div>
        <SaveButton dirty={dirty} loading={updateNotificationPreferences.isPending} onClick={handleSave}>
          {t('Lưu giờ im lặng')}
        </SaveButton>
      </div>
    </SettingsCard>
  )
}

// Bảo mật: đổi mật khẩu qua luồng quên mật khẩu

function SecurityCard() {
  const { forgotPassword, resetPassword } = useAuth()
  const user = useAuthStore(s => s.user)
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const resetErrors = validatePasswordReset({ code: token, newPassword, confirmPassword })

  function handleSend() {
    if (!user?.email) return
    forgotPassword.mutate(user.email, {
      onSuccess: () => { setSent(true); push('Đã gửi mã đặt lại tới email của bạn') },
      onError: (err) => push(apiErrorMessage(err, t('Gửi mã thất bại')), 'error'),
    })
  }

  function handleReset(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!user?.email || Object.keys(resetErrors).length > 0) return
    resetPassword.mutate({ email: user.email, token: token.trim(), newPassword }, {
      onSuccess: () => { push('Đã đổi mật khẩu. Đăng nhập lại trên các thiết bị khác.'); setSent(false); setToken(''); setNewPassword(''); setConfirmPassword(''); setSubmitted(false) },
      onError: (err) => push(apiErrorMessage(err, t('Đặt lại mật khẩu thất bại')), 'error'),
    })
  }

  return (
    <SettingsCard icon={ShieldCheckIcon} title="Bảo mật" subtitle="Đổi mật khẩu bằng mã gửi về email hiện tại">
      {!sent ? (
        <Button variant="secondary" className="w-full" loading={forgotPassword.isPending} onClick={handleSend}>
          Gửi mã đặt lại mật khẩu
        </Button>
      ) : (
        <form onSubmit={handleReset} noValidate className="flex flex-col gap-3">
          <p className="rounded-xl bg-limeMist/60 px-3.5 py-2.5 text-small text-charcoal">
            {t('Đã gửi mã 6 số tới')} <span className="font-semibold">{user?.email}</span>.
          </p>
          <Input label="Mã đặt lại (6 số)" required inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e => setToken(e.target.value)} maxLength={6} error={submitted ? resetErrors.code : undefined} />
          <Input label="Mật khẩu mới" type="password" required maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} error={submitted ? resetErrors.newPassword : undefined} />
          <Input label="Nhập lại mật khẩu mới" type="password" required maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} error={submitted ? resetErrors.confirmPassword : undefined} />
          <Button type="submit" loading={resetPassword.isPending} className="w-full">Đổi mật khẩu</Button>
        </form>
      )}
    </SettingsCard>
  )
}

// Telegram

function TelegramCard() {
  const user = useAuthStore(s => s.user)
  const { createTelegramLink, checkTelegramLink, unlinkTelegram } = useAuth()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [link, setLink] = useState<{ deep_link: string; expires_at: string } | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [showUnlink, setShowUnlink] = useState(false)
  const linked = user?.telegram_linked ?? false
  // Push của mức Khẩn cấp đã tắt thì Telegram là kênh ngoài ứng dụng duy nhất: backend từ chối gỡ
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
          push('Chưa thấy liên kết. Bấm Start trong Telegram rồi kiểm tra lại.', 'error')
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
        <Button variant="secondary" className="w-full" loading={createTelegramLink.isPending} onClick={handleCreate}>{t('Liên kết Telegram')}</Button>
      )}

      <ConfirmModal
        open={showUnlink} title="Gỡ liên kết Telegram?" danger
        description={urgentPushOff
          ? 'Thông báo đẩy cho cảnh báo Khẩn cấp đang tắt. Gỡ Telegram thì cảnh báo Khẩn cấp không còn kênh nào ngoài ứng dụng, nên chưa gỡ được. Bật thông báo đẩy cho mức Khẩn cấp trước.'
          : 'Bạn sẽ không nhận cảnh báo qua Telegram nữa cho tới khi liên kết lại.'}
        loading={unlinkTelegram.isPending}
        onConfirm={handleUnlink} onCancel={() => setShowUnlink(false)}
      />
    </SettingsCard>
  )
}

// Dữ liệu tài khoản

// Administrator xử lý trong 30 ngày kể từ lúc gửi
const DELETION_DEADLINE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function DeletionCard() {
  const user = useAuthStore(s => s.user)
  const { requestDeletion, cancelDeletion } = useAuth()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [showConfirm, setShowConfirm] = useState(false)

  // DELETION_REQUESTED → ACTIVE khi người dùng huỷ, trước khi Administrator xử lý
  function handleCancel() {
    cancelDeletion.mutate(undefined, {
      onSuccess: () => push('Đã huỷ yêu cầu xoá tài khoản'),
      onError: (err) => push(apiErrorMessage(err, t('Huỷ yêu cầu thất bại')), 'error'),
    })
  }

  function handleConfirm() {
    requestDeletion.mutate(undefined, {
      onSuccess: () => { push('Đã gửi yêu cầu xoá tài khoản'); setShowConfirm(false) },
      onError: (err) => push(apiErrorMessage(err, t('Gửi yêu cầu thất bại')), 'error'),
    })
  }

  return (
    // Vùng nguy hiểm: viền + ô icon đỏ nhạt để tách khỏi các card cài đặt thường
    <SettingsCard icon={TrashIcon} title="Dữ liệu tài khoản" subtitle="Yêu cầu xoá tài khoản theo Nghị định 13/2023/NĐ-CP" danger>
      {user?.deletion_requested_at ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-warmGray/10 px-4 py-3 text-body text-charcoal">
            {t('Đã gửi yêu cầu xoá tài khoản ngày {{date}}. Quản trị viên xử lý trước {{deadline}}.', {
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
        <Button variant="secondary" className="w-full border-alertRed/40 text-alertRed hover:bg-alertRed/5" onClick={() => setShowConfirm(true)}>{t('Yêu cầu xoá tài khoản', { context: 'button' })}</Button>
      )}

      <ConfirmModal
        open={showConfirm} title="Yêu cầu xoá tài khoản?" danger
        description="Quản trị viên xử lý yêu cầu trong tối đa 30 ngày. Nếu bạn là chủ chính và trang trại còn thành viên khác, quyền sở hữu tự chuyển cho người đó."
        loading={requestDeletion.isPending}
        onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)}
      />
    </SettingsCard>
  )
}
