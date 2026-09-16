import { useState, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input } from '@/components/ui'
import { IconTemp, IconHumidity, IconSound } from '@/components/ui/icons'
import { getApiErrorMessage } from '@/utils/helpers'

/** Login Page – AUTH-FR-002 */
export default function LoginPage() {
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate({ email, password, returnTo })
  }

  const errorMessage = login.isError ? getApiErrorMessage(login.error, 'Đăng nhập thất bại') : undefined

  return (
    <div className="flex min-h-screen bg-white">
      {/* Cột form */}
      <div className="flex w-full flex-col justify-center px-6 py-10 lg:w-[46%] lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-sm font-extrabold text-white">
              S
            </span>
            <span className="text-base font-bold tracking-tight text-charcoal">SwiftletCare</span>
          </div>

          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-charcoal">
            Đăng nhập
          </h1>
          <p className="mt-1.5 text-sm text-warmGray">
            Giám sát và điều khiển nhà yến từ xa
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <Input
              label="Email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <Input
              label="Mật khẩu" type="password" required autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <Link to="/forgot-password" className="-mt-2 self-end text-xs font-semibold text-charcoal underline underline-offset-2">
              Quên mật khẩu?
            </Link>
            {errorMessage && (
              <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">
                {errorMessage}
              </p>
            )}
            <Button type="submit" size="lg" loading={login.isPending} className="mt-2 w-full">
              Đăng nhập
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-warmGray">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-semibold text-charcoal underline underline-offset-2">
              Đăng ký
            </Link>
          </p>
        </div>
      </div>

      {/* Cột giới thiệu — ẩn trên mobile để form chiếm trọn màn hình */}
      <div className="hidden flex-1 items-center justify-center bg-charcoal p-12 lg:flex">
        <div className="w-full max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
            Hệ thống giám sát nhà yến
          </p>
          <p className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white">
            Vi khí hậu ổn định,
            <br />
            đàn yến ở lại.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Theo dõi nhiệt độ, độ ẩm, khí NH3/CO2 và âm thanh theo thời gian thực;
            hệ thống tự điều khiển phun sương, thông gió và loa ru ngay cả khi mất
            kết nối Internet.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <StatChip icon={<IconTemp width={18} height={18} />} value="26–31" unit="°C" />
            <StatChip icon={<IconHumidity width={18} height={18} />} value="75–95" unit="%" />
            <StatChip icon={<IconSound width={18} height={18} />} value="24/7" unit="giám sát" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatChip({ icon, value, unit }: { icon: React.ReactNode; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-limeMist text-charcoal">
        {icon}
      </span>
      <p className="mt-3 text-lg font-extrabold leading-none text-white">{value}</p>
      <p className="mt-1 text-xs text-white/50">{unit}</p>
    </div>
  )
}
