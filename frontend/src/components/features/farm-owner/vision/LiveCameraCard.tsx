import { useRef, useState, type ReactNode } from 'react'
import { ArrowsInIcon, ArrowsOutIcon, HourglassIcon, VideoCameraSlashIcon, WarningIcon, WifiSlashIcon } from '@phosphor-icons/react'
import StatusDot from '@/components/common/StatusDot'
import { Button, Card, SelectMenu } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useHousesBirdCountCurrent } from '@/hooks/farm-owner/useAnalytics'
import { useHouseCameras } from '@/hooks/farm-owner/useHouseCameras'
import { useWhepStream } from '@/hooks/farm-owner/useWhepStream'
import { cn } from '@/lib/cn'
import type { DeviceStatus } from '@/types'

// Trạng thái camera backend trả về mà vẫn mở luồng xem (DEGRADED: camera còn hình nhưng nút AI suy giảm)
const STREAMABLE_STATUSES = new Set<DeviceStatus>(['ONLINE', 'DEGRADED'])

interface LiveCameraCardProps {
  houseId: string
  houseName: string
  // Có thì hiện nút phóng to / thu nhỏ khung camera
  expanded?: boolean
  onToggleExpand?: () => void
  // Nút phụ góc phải đầu khung (VD link sang trang Giám sát đàn chim)
  action?: ReactNode
}

// Khung xem trực tiếp camera cửa thu chim của 1 nhà yến (VISION-FR-013) + thông số camera và số đếm hôm nay, đều lấy từ backend
export default function LiveCameraCard({ houseId, houseName, expanded = false, onToggleExpand, action }: LiveCameraCardProps) {
  const { t, num, ago, date } = useTranslation(dashboardDict)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { data: cameras, isLoading, isError, refetch } = useHouseCameras(houseId)
  const { today } = useHousesBirdCountCurrent(houseId ? [houseId] : [])
  const [pickedCameraId, setPickedCameraId] = useState('')
  const camera = cameras?.find(item => item._id === pickedCameraId) ?? cameras?.[0]
  const canStream = camera !== undefined && STREAMABLE_STATUSES.has(camera.status)
  const { status, retry } = useWhepStream(videoRef, canStream ? camera._id : undefined)
  const isPlaying = status === 'playing'

  // Lớp phủ giữa khung theo trạng thái backend trả về; đang phát thì không phủ
  let overlay: ReactNode = null
  if (isLoading) overlay = <StreamMessage title={t('camera.loading')} />
  else if (isError) overlay = <StreamMessage title={t('camera.loadError')} action={<RetryButton label={t('camera.retry')} onClick={() => void refetch()} />} />
  else if (!camera) overlay = <StreamMessage icon={<VideoCameraSlashIcon size={28} />} title={t('camera.noCamera')} description={t('camera.noCameraDesc')} />
  else if (camera.status === 'PENDING') overlay = <StreamMessage icon={<HourglassIcon size={28} />} title={t('camera.pending')} description={t('camera.pendingDesc')} />
  else if (camera.status === 'ERROR') overlay = <StreamMessage icon={<WarningIcon size={28} />} title={t('camera.error')} description={t('camera.errorDesc')} />
  else if (camera.status === 'OFFLINE') overlay = <StreamMessage icon={<WifiSlashIcon size={28} />} title={t('camera.offline')} description={t('camera.offlineDesc')} />
  else if (status === 'failed') overlay = <StreamMessage title={t('camera.failed')} description={t('camera.failedDesc')} action={<RetryButton label={t('camera.retry')} onClick={retry} />} />
  else if (!isPlaying) overlay = <StreamMessage title={t('camera.connecting')} />

  const expandLabel = expanded ? t('camera.collapse') : t('camera.expand')
  // Số đếm hôm nay: nhà chưa có tin đếm (updated_at null) thì "_", không hiện 0
  const hasToday = today?.updatedAt != null
  const ring = camera?.counting_ring

  // Thông số camera + đếm hôm nay; mọi giá trị từ GET /devices/camera-nodes và /analytics/bird-count/current
  const params: Array<{ label: string; value: ReactNode }> = [
    { label: t('camera.paramStatus'), value: camera ? <StatusDot status={camera.status} /> : NO_VALUE },
    { label: t('camera.paramHeartbeat'), value: camera ? ago(camera.last_heartbeat) : NO_VALUE },
    { label: t('camera.paramModel'), value: camera?.model_version ? `v${camera.model_version}` : NO_VALUE },
    {
      label: t('camera.paramRing'),
      value: !camera ? NO_VALUE : ring ? t('camera.ringSet', { date: ring.updated_at ? date(ring.updated_at) : NO_VALUE }) : t('camera.ringDefault'),
    },
    { label: t('camera.paramExit'), value: hasToday ? num(today.morningExit) : NO_VALUE },
    { label: t('camera.paramEntry'), value: hasToday ? num(today.eveningEntry) : NO_VALUE },
    { label: t('camera.paramReturn'), value: hasToday && today.returnRate !== null ? `${num(today.returnRate, 1)}%` : NO_VALUE },
  ]

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Chấm xanh khi đang phát, xám khi chưa có hình */}
            <span className={cn('h-2 w-2 shrink-0 rounded-full', isPlaying ? 'bg-accent-600' : 'bg-warmGray/40')} />
            <h2 className="text-h2 text-charcoal">{t('camera.title')}</h2>
          </div>
          <p className="mt-1 text-sm text-warmGray">{t('camera.subtitle', { house: houseName })}</p>
        </div>
        <div className="flex items-center gap-2">
          {(cameras?.length ?? 0) > 1 && (
            <SelectMenu
              ariaLabel={t('camera.pick')}
              value={camera?._id ?? ''}
              options={(cameras ?? []).map(item => ({ value: item._id, label: item.device_id }))}
              onChange={setPickedCameraId}
              highlightFiltered={false}
              className="h-9 w-40 justify-between"
            />
          )}
          {action}
        </div>
      </div>

      <div className={cn('relative aspect-video overflow-hidden rounded-2xl bg-graphite', expanded && 'max-h-[70vh]')}>
        <video ref={videoRef} autoPlay muted playsInline className={cn('h-full w-full object-contain', !isPlaying && 'invisible')} />
        {overlay && <div className="absolute inset-0 flex items-center justify-center p-6">{overlay}</div>}

        {/* Thanh dưới khung: nhãn Trực tiếp khi đang phát, cảnh báo AI suy giảm, nút phóng to nếu trang cho phép */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2 text-[11px] font-medium text-white">
          <span className="flex items-center gap-2">
            <span className={cn('inline-flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 backdrop-blur-sm', !isPlaying && 'invisible')}>
              <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
              {t('camera.live')}
            </span>
            {camera?.status === 'DEGRADED' && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-safetyOrange/90 px-3">
                <WarningIcon size={12} weight="bold" />
                {t('camera.degraded')}
              </span>
            )}
          </span>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              title={expandLabel}
              aria-label={expandLabel}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/75"
            >
              {expanded ? <ArrowsInIcon size={16} /> : <ArrowsOutIcon size={16} />}
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {params.map(param => (
          <div key={param.label} className="min-w-0">
            <dt className="truncate text-xs text-warmGray">{param.label}</dt>
            <dd className={cn('truncate text-sm font-semibold', param.value === NO_VALUE ? 'text-warmGray' : 'text-charcoal')}>{param.value}</dd>
          </div>
        ))}
      </dl>
      {isPlaying && <p className="text-xs text-warmGray">{t('camera.boxesHint')}</p>}
    </Card>
  )
}

// Thông báo trạng thái giữa khung video tối
function StreamMessage({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-2 text-center text-white/80">
      {icon}
      <p className="text-sm font-semibold text-white">{title}</p>
      {description && <p className="text-xs text-white/60">{description}</p>}
      {action}
    </div>
  )
}

function RetryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" className="mt-1" onClick={onClick}>
      {label}
    </Button>
  )
}
