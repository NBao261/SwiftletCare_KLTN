// Invitation Page (public) – AUTH-FR-010, Flow 12. Không có đăng ký công khai (Report 3 §1.2): người được mời chưa có
// tài khoản đặt tên + mật khẩu ngay tại đây (POST /invitations/{token}/create-account), rồi đăng nhập với email đã điền sẵn
import { useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useInvitationPreview, useAcceptInvitation, useDeclineInvitation, useCreateAccountFromInvitation } from '@/hooks/auth/useInvitations'
import { Button, Card, Input } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { INVITE_ROLE_LABEL } from '@/constants/roles'
import { getRoleHomePath } from '@/constants/roles'

/** Khớp spec create-account: full_name ≥ 1 ký tự, password ≥ 8 */
const PASSWORD_MIN = 8

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const push = useToastStore(s => s.push)
  const { user, isAuthenticated } = useAuthStore()
  const { data, isLoading, isError } = useInvitationPreview(token)
  const accept = useAcceptInvitation()
  const decline = useDeclineInvitation()
  const createAccount = useCreateAccountFromInvitation()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (isLoading) {
    return <div className="mx-auto max-w-md px-4 py-16"><LoadingSkeleton className="h-64 w-full" /></div>
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card size="lg" className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-charcoal">Lời mời không tồn tại</h1>
          <p className="mt-2 text-sm text-warmGray">Đường link có thể sai hoặc lời mời đã bị xoá.</p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-charcoal underline">Về trang đăng nhập</Link>
        </Card>
      </div>
    )
  }

  const { invitation, farm, userExists } = data
  const isExpired = invitation.status !== 'PENDING'
  const loggedInAsInvitedEmail = isAuthenticated && user?.email?.toLowerCase() === invitation.invited_email.toLowerCase()

  function handleAccept() {
    if (!token) return
    accept.mutate(token, {
      // Chấp nhận lời mời không đổi role của tài khoản hiện có (chỉ thêm vào
      // farm.members — xem farm.service.ts), nên user.role trong store vẫn
      // đúng ngay lúc này — về đúng trang nhà của role đó thay vì hardcode
      // '/dashboard' (chuyên gia sẽ bị văng /403).
      onSuccess: () => { push('Đã chấp nhận lời mời'); navigate(getRoleHomePath(user?.role)) },
      onError: (err) => push(getApiErrorMessage(err, 'Chấp nhận thất bại'), 'error'),
    })
  }

  const nameError = submitted && !fullName.trim() ? 'Chưa nhập họ tên' : undefined
  const passwordError = submitted && password.length < PASSWORD_MIN ? `Tối thiểu ${PASSWORD_MIN} ký tự` : undefined

  function handleCreateAccount(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!token || !fullName.trim() || password.length < PASSWORD_MIN) return
    createAccount.mutate({ token, full_name: fullName.trim(), password }, {
      // Tài khoản mới đã vào farm của lời mời; backend không trả token → đăng nhập với email điền sẵn
      onSuccess: () => {
        push('Đã tạo tài khoản, hãy đăng nhập')
        navigate(`/login?email=${encodeURIComponent(invitation.invited_email)}`)
      },
      // 409 lời mời đã dùng/hết hạn hoặc email đã có tài khoản, 404 farm đã xoá — backend trả message tiếng Việt
      onError: (err) => push(getApiErrorMessage(err, 'Tạo tài khoản thất bại'), 'error'),
    })
  }

  function handleDecline() {
    if (!token) return
    decline.mutate(token, {
      onSuccess: () => push('Đã từ chối lời mời'),
      onError: (err) => push(getApiErrorMessage(err, 'Từ chối thất bại'), 'error'),
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card size="lg" className="w-full max-w-md">
        <p className="label-caption">Lời mời tham gia farm</p>
        <h1 className="mt-1 text-2xl font-bold text-charcoal">{farm?.name ?? 'Farm'}</h1>
        <p className="mt-1 text-sm text-warmGray">{farm?.address}</p>

        <div className="mt-5 rounded-xl bg-warmGray/5 px-4 py-3 text-sm">
          <p><span className="text-warmGray">Email được mời:</span> <span className="font-semibold text-charcoal">{invitation.invited_email}</span></p>
          <p className="mt-1"><span className="text-warmGray">Vai trò:</span> <span className="font-semibold text-charcoal">{INVITE_ROLE_LABEL[invitation.invited_role]}</span></p>
        </div>

        {isExpired ? (
          <p className="mt-5 rounded-xl bg-alertRed/10 px-4 py-3 text-sm font-medium text-alertRed">
            Lời mời này đã {invitation.status === 'ACCEPTED' ? 'được chấp nhận' : invitation.status === 'DECLINED' ? 'bị từ chối' : 'hết hạn'} trước đó.
          </p>
        ) : !userExists ? (
          <form onSubmit={handleCreateAccount} noValidate className="mt-5 flex flex-col gap-3">
            <p className="text-sm text-warmGray">Email này chưa có tài khoản. Đặt họ tên và mật khẩu để tham gia farm.</p>
            <Input
              label="Họ và tên"
              required
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              error={nameError}
            />
            <Input
              label="Mật khẩu"
              type="password"
              required
              autoComplete="new-password"
              placeholder={`Ít nhất ${PASSWORD_MIN} ký tự`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={passwordError}
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" loading={decline.isPending} onClick={handleDecline}>Từ chối</Button>
              <Button type="submit" className="flex-1" loading={createAccount.isPending}>Tạo tài khoản</Button>
            </div>
          </form>
        ) : !loggedInAsInvitedEmail ? (
          <Button className="mt-5 w-full" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/invitations/${token}`)}`)}>
            Đăng nhập để chấp nhận
          </Button>
        ) : (
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" loading={decline.isPending} onClick={handleDecline}>Từ chối</Button>
            <Button className="flex-1" loading={accept.isPending} onClick={handleAccept}>Chấp nhận</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
