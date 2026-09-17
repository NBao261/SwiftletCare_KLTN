// Invitation Page (public) – AUTH-FR-010, Flow 12
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useInvitationPreview, useAcceptInvitation, useDeclineInvitation } from '@/hooks/useInvitations'
import { Button, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import { INVITE_ROLE_LABEL } from '@/constants/roles'

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const push = useToastStore(s => s.push)
  const { user, isAuthenticated } = useAuthStore()
  const { data, isLoading, isError } = useInvitationPreview(token)
  const accept = useAcceptInvitation()
  const decline = useDeclineInvitation()

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
      onSuccess: () => { push('Đã chấp nhận lời mời'); navigate('/dashboard') },
      onError: (err) => push(getApiErrorMessage(err, 'Chấp nhận thất bại'), 'error'),
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
          <Button className="mt-5 w-full" onClick={() => navigate(`/register?email=${encodeURIComponent(invitation.invited_email)}`)}>
            Tạo tài khoản để tham gia
          </Button>
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
