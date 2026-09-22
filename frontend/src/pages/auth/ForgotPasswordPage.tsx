// Forgot Password Page (public) – AUTH-FR-009, Flow 11 bước 6-7
import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/auth/useAuth'
import { Button, Input, Card } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/helpers'

export default function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')

  function handleSend(e: FormEvent) {
    e.preventDefault()
    forgotPassword.mutate(email, { onSuccess: () => setSent(true) })
  }

  function handleReset(e: FormEvent) {
    e.preventDefault()
    resetPassword.mutate({ email, token, newPassword }, {
      onSuccess: () => navigate('/login'),
    })
  }

  const sendError = forgotPassword.isError ? getApiErrorMessage(forgotPassword.error, 'Gửi mã thất bại') : undefined
  const resetError = resetPassword.isError ? getApiErrorMessage(resetPassword.error, 'Đặt lại mật khẩu thất bại') : undefined

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <Card size="lg" className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-charcoal">Quên mật khẩu</h1>
        <p className="mb-6 text-sm text-warmGray">Nhập email để nhận mã đặt lại mật khẩu</p>

        {!sent ? (
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <Input label="Email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            {sendError && <p className="text-sm text-alertRed">{sendError}</p>}
            <Button type="submit" size="lg" loading={forgotPassword.isPending} className="w-full">Gửi mã đặt lại</Button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <p className="rounded-xl bg-limeMist p-3 text-xs font-medium text-charcoal">
              Nếu email tồn tại, mã đặt lại đã được gửi (môi trường dev: xem console log backend, chưa nối SMTP thật).
            </p>
            <Input label="Mã đặt lại (6 số)" required value={token} onChange={e => setToken(e.target.value)} maxLength={6} />
            <Input label="Mật khẩu mới" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            {resetError && <p className="text-sm text-alertRed">{resetError}</p>}
            <Button type="submit" size="lg" loading={resetPassword.isPending} className="w-full">Đặt lại mật khẩu</Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-warmGray">
          <Link to="/login" className="font-semibold text-charcoal underline">Về trang đăng nhập</Link>
        </p>
      </Card>
    </div>
  )
}
