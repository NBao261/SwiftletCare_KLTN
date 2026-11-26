import { useMemo } from 'react';
import { CpuIcon, VideoCameraIcon } from '@phosphor-icons/react';

import SimulatedBadge from '@/components/common/SimulatedBadge';
import StatusDot from '@/components/common/StatusDot';
import TableEmptyState from '@/components/common/TableEmptyState';
import type { DeviceRow } from '@/components/features/farm-owner/devices/deviceInventory';
import { Button, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { devicesDict } from '@/constants/devices.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';

// Cùng chiều cao dòng các bảng khác của Farm Owner
const ROW_HEIGHT = 72;

interface DeviceListTableProps {
  rows: DeviceRow[];
  // Có thiết bị nào ở phạm vi đang chọn không: để phân biệt "chưa có thiết bị" với "tab này trống"
  hasAnyDevice: boolean;
  onOpen: (row: DeviceRow) => void;
}

// Bảng thiết bị, mỗi dòng một thiết bị: tên, vị trí, trạng thái, tín hiệu gần nhất, phiên bản
export default function DeviceListTable({ rows, hasAnyDevice, onOpen }: DeviceListTableProps): JSX.Element {
  const { t, ago, dateTime } = useTranslation(devicesDict);

  const columns = useMemo<DataTableColumn<DeviceRow>[]>(() => [
    {
      key: 'device',
      header: t('col.device'),
      className: 'w-[30%]',
      render: ({ device }) => {
        const isSensor = device.type === 'sensor';
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
              {isSensor ? <CpuIcon size={18} /> : <VideoCameraIcon size={18} />}
            </span>
            <div className="flex min-w-0 flex-col">
              <span title={device.deviceId} className="truncate text-sm font-semibold text-charcoal">{device.deviceId}</span>
              <span className="flex items-center gap-2 text-xs text-warmGray">
                {t(isSensor ? 'cell.kitKind' : 'cell.cameraKind')}
                <SimulatedBadge simulated={device.simulated} />
              </span>
            </div>
          </div>
        );
      },
    },
    // Nhà ở dòng trên, Zone (hoặc "Cả nhà" với camera) ở dòng dưới
    {
      key: 'place',
      header: t('col.place'),
      className: 'w-[22%]',
      render: ({ house, zone }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-charcoal">{house.name}</span>
          <span className="truncate text-xs text-warmGray">{zone?.name ?? t('cell.wholeHouse')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[16%] whitespace-nowrap',
      render: ({ device }) => <StatusDot status={device.status} colored />,
    },
    // Dòng trên: cách đây bao lâu; dòng dưới: ngày giờ chính xác
    {
      key: 'lastSeen',
      header: t('col.lastSeen'),
      className: 'w-[16%] whitespace-nowrap',
      render: ({ device }) => (device.lastHeartbeat
        ? (
          <div>
            <span className="block text-sm font-semibold text-charcoal">{ago(device.lastHeartbeat)}</span>
            <span className="block text-xs text-warmGray">{dateTime(device.lastHeartbeat)}</span>
          </div>
        )
        : <span className="text-xs italic text-warmGray">{t('cell.neverSeen')}</span>),
    },
    {
      key: 'version',
      header: t('col.version'),
      className: 'w-[8%] whitespace-nowrap',
      render: ({ device }) => <span className="text-sm text-charcoal">{device.version ?? NO_VALUE}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[8%] whitespace-nowrap',
      render: row => (
        // Bấm nút không kích hoạt thêm lần mở của dòng
        <div className="flex justify-end" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => onOpen(row)}>{t('action.detail')}</Button>
        </div>
      ),
    },
  ], [t, ago, dateTime, onOpen]);

  return (
    <FixedRowsTable
      columns={columns}
      rows={rows}
      getRowKey={row => row.device.id}
      onRowClick={onOpen}
      rowHeight={ROW_HEIGHT}
      emptyNotice={t(hasAnyDevice ? 'list.emptyTab' : 'list.noDevice')}
      emptyContent={<TableEmptyState title={t(hasAnyDevice ? 'list.emptyTab' : 'list.noDevice')} />}
      mobileCard={row => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-body font-semibold text-charcoal">{row.device.deviceId}</p>
            <StatusDot status={row.device.status} colored className="shrink-0 whitespace-nowrap" />
          </div>
          <p className="text-small text-warmGray">
            {t(row.device.type === 'sensor' ? 'cell.kitKind' : 'cell.cameraKind')} · {row.house.name} · {row.zone?.name ?? t('cell.wholeHouse')}
            {row.device.lastHeartbeat ? ` · ${ago(row.device.lastHeartbeat)}` : ''}
          </p>
          <div className="flex justify-end" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => onOpen(row)}>{t('action.detail')}</Button>
          </div>
        </div>
      )}
    />
  );
}
