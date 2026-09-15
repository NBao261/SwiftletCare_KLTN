import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Card } from '@/components/ui'

/** Register Page – AUTH-FR-001 */
export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    register.mutate(form)
  }

  const errorMessage = register.isError
    ? ((register.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Đăng ký thất bại')
    : undefined

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <Card size="lg" className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-charcoal">Tạo tài khoản</h1>
        <p className="mb-6 text-sm text-warmGray">Farm Owner — quản lý nhà yến của bạn</p>

        {register.isSuccess ? (
          <div className="rounded-2xl bg-limeMist p-4 text-sm font-medium text-charcoal">
            Đăng ký thành công! Đang chuyển tới trang đăng nhập...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Họ và tên" required
              value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            <Input
              label="Email" type="email" required autoComplete="email"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Số điện thoại"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Mật khẩu" type="password" required minLength={8} autoComplete="new-password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
            {errorMessage && <p className="text-sm text-alertRed">{errorMessage}</p>}
            <Button type="submit" size="lg" loading={register.isPending} className="mt-2 w-full">
              Đăng ký
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-warmGray">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-charcoal underline">
            Đăng nhập
          </Link>
        </p>
      </Card>
    </div>
  )
}
