import { Link } from 'react-router-dom'
import { ArrowRightIcon, CheckCircleIcon, CpuIcon, VideoCameraIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SectionCard from '@/components/ui/SectionCard'
import StatusDot from '@/components/common/StatusDot'
import { useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { formatRelativeTime } from '@/lib/helpers'
import { t } from '@/i18n'
import type { SystemNodeStatusItem } from '@/types'

const LIST_COUNT = 5

// Mất kết nối xếp trước chờ kết nối; cùng nhóm thì thiết bị mới mất tín hiệu trước
export function devicesToCheck(nodes: SystemNodeStatusItem[]): SystemNodeStatusItem[] {
  const heartbeatOf = (node: SystemNodeStatusItem) => (node.last_heartbeat ? new Date(node.last_heartbeat).getTime() : 0)
  return nodes
    .filter(node => node.status !== 'ONLINE')
    .sort((a, b) => Number(b.status === 'OFFLINE') - Number(a.status === 'OFFLINE') || heartbeatOf(b) - heartbeatOf(a))
}

// Thiết bị chưa online ở mọi trang trại: việc đầu tiên của quản trị viên khi mở Tổng quan hệ thống
export default function AttentionDevicesCard() {
  const { data, isLoading, isError, refetch } = useSystemNodeStatus()
  const nodes = devicesToCheck(data?.nodes ?? [])

  return (
    <SectionCard
      className="h-full"
      title="Thiết bị cần chú ý"
      description={nodes.length > 0 ? t('{{n}} thiết bị chưa online ở mọi trang trại', { n: nodes.length }) : t('Thiết bị chưa online ở mọi trang trại')}
      action={
        <Link to="/devices" className="group inline-flex items-center gap-1 text-small font-semibold text-charcoal hover:underline">
          {t('Xem tất cả')}
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
    >
      {isLoading ? (
        <LoadingSkeleton count={3} className="h-[52px] w-full" />
      ) : isError ? (
        <EmptyState
          icon={<WarningCircleIcon size={28} />}
          title="Không tải được thiết bị"
          action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : nodes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-accent-100 px-4 py-3 text-sm font-medium text-charcoal">
          <CheckCircleIcon size={18} weight="bold" aria-hidden className="shrink-0 text-accent-700" />
          {data && data.summary.total > 0 ? t('Tất cả thiết bị đang online') : t('Chưa có thiết bị')}
        </p>
      ) : (
        <ul className="-my-2 divide-y divide-warmGray/10">
          {nodes.slice(0, LIST_COUNT).map(node => {
            const lastSeen = node.last_heartbeat ? formatRelativeTime(node.last_heartbeat) : t('Chưa kết nối lần nào')
            const place = [node.farm_name, node.house_name, node.zone_name].join(' · ')
            const TypeIcon = node.type === 'camera' ? VideoCameraIcon : CpuIcon
            return (
              <li key={node._id}>
                <Link to="/devices" className="flex items-center gap-3 rounded-lg py-3 transition-colors hover:bg-warmGray/5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
                    <TypeIcon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-charcoal">{node.device_id}</span>
                    <span className="block truncate text-small text-warmGray" title={place}>{place}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <StatusDot status={node.status} colored />
                    <span className="text-small text-warmGray">{lastSeen}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
