import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { SUPPORT_PATH, supportCreateState } from '@/components/features/farm-owner/tickets/tickets.constants'
import { usePermission } from '@/hooks/common/usePermission'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceCounts, DeviceRow } from '@/components/features/farm-owner/farms/farmStructure'

interface AttentionDevicesCardProps {
  counts: DeviceCounts
  /** Thiết bị không ONLINE của nhà (đã lọc sẵn, theo thứ tự zone) */
  problems: DeviceRow[]
  zoneNameById: Map<string, string>
  onSelect: (device: DeviceRow) => void
}

const MAX_LISTED = 3

/** Thiết bị cần chú ý của nhà: tỷ lệ sẵn sàng + danh sách thiết bị mất kết nối/lỗi (tối đa 3, phần còn lại xem ở tab Thiết bị) */
export default function AttentionDevicesCard({ counts, problems, zoneNameById, onSelect }: AttentionDevicesCardProps) {
  const { t, num, ago } = useTranslation(farmDict)
  const navigate = useNavigate()
  // Ticket của Farm Owner ở /support (mở sẵn form báo sự cố); Technician/Admin vẫn dùng màn /tickets
  const isFarmOwner = usePermission('FARM_OWNER')
  const readiness = counts.total > 0 ? (counts.online / counts.total) * 100 : 0

  return (
    <FarmFrame title={t('attn.title')} description={t('attn.online', { online: counts.online, total: counts.total })}>
      <div>
        <div className="mb-1 flex items-center justify-between text-small">
          <span className="text-warmGray">{t('attn.readiness')}</span>
          <span className="font-semibold text-charcoal">{num(readiness, 0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/15" role="presentation">
          <div className="h-full rounded-full bg-success" style={{ width: `${readiness}%` }} />
        </div>
      </div>

      {problems.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-warmGray/5 px-3 py-3 text-small text-graphite">
          <CheckCircleIcon size={18} className="shrink-0 text-warmGray" />
          {t('attn.allGood')}
        </div>
      ) : (
        problems.slice(0, MAX_LISTED).map(d => (
          <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-climateOrange/30 bg-climateOrange/[0.06] px-3 py-3">
            <button type="button" onClick={() => onSelect(d)} className="flex items-start gap-2 text-left">
              <WarningCircleIcon size={18} className="mt-0.5 shrink-0 text-climateOrange" />
              <span className="min-w-0">
                <span className="block truncate text-small font-semibold text-charcoal">{t(d.type === 'sensor' ? 'device.sensor.name' : 'device.camera.name')} · {d.deviceId}</span>
                <span className="block truncate text-caption text-warmGray">
                  {zoneNameById.get(d.zoneId) ?? ''} · {t(`status.${d.status}`)} · {d.lastHeartbeat ? t('attn.lastSeen', { ago: ago(d.lastHeartbeat) }) : t('attn.neverSeen')}
                </span>
              </span>
            </button>
            <Button variant="secondary" size="sm" className={cn('h-8 self-start px-3.5 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => (isFarmOwner ? navigate(SUPPORT_PATH, { state: supportCreateState('fault', { zoneId: d.zoneId }) }) : navigate('/tickets'))}>
              {t('attn.report')}
            </Button>
          </div>
        ))
      )}
      {problems.length > MAX_LISTED && <p className="text-small text-warmGray">{t('attn.more', { n: problems.length - MAX_LISTED })}</p>}
    </FarmFrame>
  )
}
