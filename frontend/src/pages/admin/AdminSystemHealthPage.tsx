// ADMIN — Tổng quan hệ thống (SYSTEM-FR-003), thay thế /system-status cũ.
// Chỉ số đếm theo trạng thái, KHÔNG phải BI/xu hướng — không thêm biểu đồ ở đây.
import { useSystemHealth } from '@/hooks/admin/useSystem'
import { Card } from '@/components/ui'
import DeviceStatusSummary from '@/components/features/admin/system/DeviceStatusSummary'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import { IconAlert } from '@/components/ui/icons'
import { PRIORITY_TONE } from '@/constants/tickets'
import { ROLE_LABEL } from '@/constants/roles'
import { getApiErrorMessage } from '@/lib/helpers'
import type { Role } from '@/types'

const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'TECHNICIAN', 'SALES_STAFF']
const PRIORITY_ACCENT_CLASS: Record<'critical' | 'warning' | 'neutral', string> = {
  critical: 'border-alertRed/40', warning: 'border-climateOrange/40', neutral: 'border-warmGray/15',
}

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useSystemHealth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-caption">Toàn hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Tổng quan hệ thống</h1>
      </div>

      {isLoading && <LoadingSkeleton count={4} className="h-16 w-full" />}

      {!isLoading && error && (
        <EmptyState
          icon={<IconAlert width={28} height={28} />}
          title="Không tải được số liệu hệ thống"
          description={getApiErrorMessage(error, 'Thử tải lại trang.')}
        />
      )}

      {data && (
        <>
          <section className="flex flex-col gap-3">
            <p className="label-caption">Trang trại</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Farm đang hoạt động" value={data.farms.total} />
              <StatCard label="Zone" value={data.zones.total} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <p className="label-caption">Ticket đang mở theo độ ưu tiên</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Tổng đang mở" value={data.openTickets.total} />
              {(['P1', 'P2', 'P3'] as const).map(p => (
                <Card key={p} className={`text-center border ${PRIORITY_ACCENT_CLASS[PRIORITY_TONE[p]]}`}>
                  <p className="text-2xl font-extrabold text-charcoal">{data.openTickets[p]}</p>
                  <p className="mt-1 text-xs text-warmGray">{p} đang mở</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <p className="label-caption">Tài khoản</p>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Tổng số" value={data.users.total} />
              <StatCard label="Hoạt động" value={data.users.active} />
              <StatCard label="Đã khoá / đã xoá" value={data.users.inactive} />
            </div>
            {/* Hàng đợi chờ xoá không có trong health-overview — xem trang Yêu cầu tài khoản */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ROLES.map(role => {
                const byRole = data.users.byRole[role]
                return (
                  <StatCard
                    key={role}
                    label={ROLE_LABEL[role]}
                    value={byRole?.active ?? 0}
                    hint={byRole?.inactive ? `+${byRole.inactive} khoá/đã xoá` : undefined}
                  />
                )
              })}
            </div>
          </section>

          <DeviceStatusSummary summary={data.devices} />
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-extrabold text-charcoal">{value}</p>
      <p className="mt-1 text-xs text-warmGray">{label}</p>
      {hint && <p className="text-[11px] text-warmGray/80">{hint}</p>}
    </Card>
  )
}
