import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Card } from '@/components/ui'

/** Login Page – AUTH-FR-002 */
export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate({ email, password })
  }

  const errorMessage = login.isError
    ? ((login.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Đăng nhập thất bại')
    : undefined

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Card size="lg" className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-charcoal">Đăng nhập</h1>
        <p className="mb-6 text-sm text-warmGray">Quản lý nhà yến thông minh</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <Input
            label="Mật khẩu" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          {errorMessage && <p className="text-sm text-alertRed">{errorMessage}</p>}
          <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
            Đăng nhập
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-warmGray">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-semibold text-charcoal underline">
            Đăng ký
          </Link>
        </p>
      </Card>
    </div>
  )
}
