import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { Card, Badge, Button } from '@/components/ui'

/** Settings Page – hồ sơ tài khoản (AUTH-FR-001..004) */
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

        <Button variant="danger" className="mt-6 w-full" onClick={() => logout.mutate()}>
          Đăng xuất
        </Button>
      </Card>
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
