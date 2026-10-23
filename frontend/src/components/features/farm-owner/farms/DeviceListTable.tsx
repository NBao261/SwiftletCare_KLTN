import { useMemo } from 'react'
import { CpuIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { type DataTableColumn } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import StatusDot from '@/components/common/StatusDot'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { DETAIL_BUTTON_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { wifiQuality, type DeviceRow } from '@/components/features/farm-owner/farms/farmStructure'
import { NO_VALUE } from '@/constants/display'

interface DeviceListTableProps {
  devices: DeviceRow[]
  /** Có thì thêm cột "Zone" (tab Thiết bị của cả nhà); trang zone không cần */
  zoneNameById?: Map<string, string>
  onSelect: (device: DeviceRow) => void
}

/** Bảng thiết bị (sensor + camera) của 1 zone hoặc 1 nhà — bấm "Chi tiết" mở drawer bên phải */
export default function DeviceListTable({ devices, zoneNameById, onSelect }: DeviceListTableProps) {
  const { t, ago } = useTranslation(farmDict)

  const columns = useMemo<DataTableColumn<DeviceRow>[]>(() => {
    const cols: DataTableColumn<DeviceRow>[] = [
      {
        key: 'device', header: t('device.col.device'), className: 'w-[24%]',
        render: d => (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
              {d.type === 'sensor' ? <CpuIcon size={18} /> : <VideoCameraIcon size={18} />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-charcoal">{t(d.type === 'sensor' ? 'device.sensor.name' : 'device.camera.name')}</p>
              <p className="truncate text-small text-warmGray">{t(d.type === 'sensor' ? 'device.sensor.model' : 'device.camera.model')}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'id', header: t('device.col.id'), className: 'w-[16%] whitespace-nowrap',
        render: d => <span className="rounded-lg bg-warmGray/10 px-2 py-1 text-caption text-graphite">{d.deviceId}</span>,
      },
    ]
    if (zoneNameById) {
      cols.push({ key: 'zone', header: 'Zone', className: 'w-[8%]', render: d => <span className="text-charcoal">{zoneNameById.get(d.zoneId) ?? NO_VALUE}</span> })
    }
    cols.push(
      { key: 'status', header: t('device.col.status'), className: 'w-[12%]', render: d => <StatusDot status={d.status} /> },
      {
        key: 'wifi', header: 'Wi-Fi', className: 'w-[16%] whitespace-nowrap',
        render: d => {
          const q = wifiQuality(d.rssi)
          return d.rssi === undefined || !q
            ? <span className="text-warmGray">{NO_VALUE}</span>
            : <span className="text-charcoal">{d.rssi} dBm <span className="text-warmGray">· {t(`wifi.${q}`)}</span></span>
        },
      },
      { key: 'fw', header: 'Firmware', className: 'w-[9%] whitespace-nowrap', render: d => <span className="text-charcoal">{d.firmware ? `v${d.firmware}` : NO_VALUE}</span> },
      { key: 'hb', header: 'Heartbeat', className: 'w-[10%] whitespace-nowrap', render: d => <span className="text-warmGray">{ago(d.lastHeartbeat)}</span> },
      {
        key: 'actions', header: t('device.col.actions'), align: 'center', className: 'w-[11%] whitespace-nowrap',
        render: d => (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onSelect(d) }}
            className={DETAIL_BUTTON_CLASS}
          >
            {t('device.detail')}
          </button>
        ),
      },
    )
    return cols
  }, [t, ago, zoneNameById, onSelect])

  return <FixedRowsTable columns={columns} rows={devices} getRowKey={device => device.id} onRowClick={onSelect} emptyNotice={t(zoneNameById ? 'house.noDevice' : 'device.empty')} emptyContent={<TableEmptyState title={t(zoneNameById ? 'house.noDevice' : 'device.empty')} />} rowHeight={64} />
}
