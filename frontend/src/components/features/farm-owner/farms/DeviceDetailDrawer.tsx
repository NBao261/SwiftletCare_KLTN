import { useState } from 'react'
import { CpuIcon, InfoIcon, TicketIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { ZONE_METRICS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { wifiQuality, type DeviceRow, type ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'
import { useDeviceProfile } from '@/hooks/farm-owner/useFarmStructure'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'
import type { DeviceStatus } from '@/types'
import { NO_VALUE } from '@/constants/display'
import CreateSupportTicketModal, { type CreateSupportDefaults } from '@/components/features/farm-owner/tickets/CreateSupportTicketModal'

const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
  ONLINE: 'positive', OFFLINE: 'neutral', ERROR: 'critical', DEGRADED: 'warning', PENDING: 'warning',
}

interface DeviceDetailDrawerProps { device: DeviceRow | null; zoneNode?: ZoneNode; onClose: () => void }

// Drawer chi tiết thiết bị (Farm Owner chỉ xem); kỹ thuật viên lắp, firmware mới nhất chưa có API nên hiện NO_VALUE
export default function DeviceDetailDrawer({ device, zoneNode, onClose }: DeviceDetailDrawerProps) {
  const { t, num, day, ago } = useTranslation(farmDict)
  const navigate = useNavigate()
  // Ticket của Farm Owner ở /support (mở sẵn form báo sự cố); Technician/Admin vẫn dùng màn /tickets
  const isFarmOwner = usePermission('FARM_OWNER')
  // Popup yêu cầu hỗ trợ mở tại chỗ (không chuyển sang trang Yêu cầu hỗ trợ); undefined = đóng
  const [supportDefaults, setSupportDefaults] = useState<CreateSupportDefaults>()
  const { data: profile } = useDeviceProfile(device?.deviceId)

  if (!device) return <Drawer open={false} onClose={onClose}>{null}</Drawer>

  const q = wifiQuality(device.rssi)
  const isSensor = device.type === 'sensor'
  const over = new Set<string>(zoneNode?.breaches.map(breach => breach.metric))
  const isLatest = !!device.firmware && device.firmware === profile?.latestFirmware
  const location = zoneNode ? `${zoneNode.house.name} › ${zoneNode.zone.name}` : NO_VALUE

  const rows: Array<[string, string]> = [
    [t('drawer.location'), location],
    [t('drawer.type'), t(isSensor ? 'device.sensor.model' : 'device.camera.model')],
    ['Wi-Fi', device.rssi !== undefined && q ? `${device.rssi} dBm · ${t(`wifi.${q}`)}` : NO_VALUE],
    ['Firmware', device.firmware ? `v${device.firmware}${isLatest ? ` · ${t('drawer.latest')}` : ''}` : NO_VALUE],
    [t('drawer.heartbeat'), ago(device.lastHeartbeat)],
    [t('drawer.activated'), day(device.registeredAt)],
    [t('drawer.installer'), profile?.installedBy ?? NO_VALUE],
  ]

  return (
    <Drawer open onClose={onClose} title={t('drawer.title')}>
      <div className="-mx-6 flex-1 overflow-y-auto px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warmGray/10 text-charcoal">
              {isSensor ? <CpuIcon size={24} /> : <VideoCameraIcon size={24} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-h3 text-charcoal">{t(isSensor ? 'device.sensor.name' : 'device.camera.name')}</p>
              <p className="truncate text-small text-warmGray">{device.deviceId}</p>
            </div>
          </div>
          <Badge tone={STATUS_TONE[device.status]}>{t(`status.${device.status}`)}</Badge>
        </div>

        <dl className="mt-4 divide-y divide-warmGray/10 border-y border-warmGray/10">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-small">
              <dt className="text-warmGray">{label}</dt>
              <dd className="text-right font-semibold text-charcoal">{value}</dd>
            </div>
          ))}
        </dl>

        {isSensor && zoneNode?.metrics && (
          <>
            <h3 className="mt-5 text-h3 text-charcoal">{t('drawer.latestReadings', { zone: zoneNode.zone.name })}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ZONE_METRICS.map(metric => {
                const value = zoneNode.metrics?.[metric.key]
                const isOver = over.has(metric.key)
                return (
                  <div key={metric.key} className={cn('rounded-xl px-3 py-2', isOver ? 'bg-climateOrange/10' : 'bg-warmGray/10')}>
                    <p className={cn('text-caption', isOver ? 'text-climateOrange' : 'text-warmGray')}>
                      {t(metric.labelKey)}{isOver ? ` · ${t('drawer.overThreshold')}` : ''}
                    </p>
                    <p className={cn('text-small font-bold', isOver ? 'text-climateOrange' : 'text-charcoal')}>
                      {value !== undefined ? `${num(value, metric.decimals)} ${metric.unit}` : NO_VALUE}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-600 px-3 py-3 text-small text-charcoal">
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          {t('drawer.readOnly')}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <Button className="w-full" onClick={() => (isFarmOwner ? setSupportDefaults({ kind: 'fault', zoneId: device.zoneId }) : navigate('/tickets'))}>
          <TicketIcon size={16} />
          {t('drawer.report')}
        </Button>
        <Button variant="secondary" className="w-full" onClick={onClose}>{t('drawer.close')}</Button>
      </div>
      <CreateSupportTicketModal open={supportDefaults !== undefined} defaults={supportDefaults} onClose={() => setSupportDefaults(undefined)} />
    </Drawer>
  )
}
