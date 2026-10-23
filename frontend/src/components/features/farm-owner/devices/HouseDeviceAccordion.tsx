import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDownIcon, CpuIcon, VideoCameraIcon } from '@phosphor-icons/react';

import StatusDot from '@/components/common/StatusDot';
import TableEmptyState from '@/components/common/TableEmptyState';
import { Card, ClearFiltersButton, SearchInput, SelectMenu, SortChips } from '@/components/ui';
import HouseHealthPill from '@/components/features/farm-owner/devices/HouseHealthPill';
import {
  houseHealthOf, queryInventory, type DeviceItem, type HouseHealth, type HouseInventory, type InventorySortKey,
} from '@/components/features/farm-owner/devices/deviceInventory';
import { DEVICE_DETAIL_PATH, type DeviceDetailState } from '@/components/features/farm-owner/devices/devices.constants';
import { DETAIL_BUTTON_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { SortDirection } from '@/types';

// Cột hàng nhà yến: tên · quy mô · trạng thái · thao tác
const HOUSE_GRID = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.8fr)_6.5rem] md:items-center md:gap-4';
// Cột hàng bộ kit: tên bộ kit · on/off · thao tác
const DEVICE_GRID = 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4';
const HEALTH_FILTERS: HouseHealth[] = ['good', 'fault', 'empty'];
const DEFAULT_SORT_KEY: InventorySortKey = 'name';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

interface HouseDeviceAccordionProps {
  inventory: HouseInventory[];
  farmName: string;
}

// Bảng thiết bị dạng cha - con: tìm / lọc / sắp xếp nhà yến ở client; bấm hàng nhà để xổ / thu thiết bị theo Zone; nút "Chi tiết" mới chuyển trang (chỉ xem)
export default function HouseDeviceAccordion({ inventory, farmName }: HouseDeviceAccordionProps): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const navigate = useNavigate();
  // Nhà đã bấm đổi trạng thái xổ; chỉ có 1 nhà hoặc khớp tìm kiếm nhờ Zone / thiết bị thì mặc định xổ sẵn
  const [toggledIds, setToggledIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<HouseHealth | ''>('');
  const [sortKey, setSortKey] = useState<InventorySortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  const { items, matchedInside } = useMemo(
    () => queryInventory(inventory, { keyword: search, health: healthFilter, sortKey, sortDirection }),
    [inventory, search, healthFilter, sortKey, sortDirection],
  );
  // Số nhà theo từng tình trạng cho ô lọc
  const healthCounts = useMemo(() => {
    const counts: Record<HouseHealth, number> = { good: 0, fault: 0, empty: 0 };
    for (const item of inventory) counts[houseHealthOf(item.tally)] += 1;
    return counts;
  }, [inventory]);

  const activeFilterCount = [search.trim(), healthFilter].filter(value => value !== '').length
    + (sortKey !== DEFAULT_SORT_KEY || sortDirection !== DEFAULT_SORT_DIRECTION ? 1 : 0);
  const isFiltering = activeFilterCount > 0;
  const isSingleHouse = inventory.length === 1;

  function toggle(houseId: string): void {
    setToggledIds(current => {
      const next = new Set(current);
      if (next.has(houseId)) next.delete(houseId);
      else next.add(houseId);
      return next;
    });
  }

  // Bấm lại tiêu chí đang sắp thì đảo chiều; tên mặc định A→Z, số đếm mặc định lớn trước
  function handleSortChange(key: InventorySortKey): void {
    if (key === sortKey) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  }

  function clearFilters(): void {
    setSearch('');
    setHealthFilter('');
    setSortKey(DEFAULT_SORT_KEY);
    setSortDirection(DEFAULT_SORT_DIRECTION);
  }

  function openDetail(state: DeviceDetailState): void {
    navigate(DEVICE_DETAIL_PATH, { state });
  }

  const healthOptions = [
    { value: '' as const, label: t('filter.all', { n: num(inventory.length) }) },
    ...HEALTH_FILTERS.map(health => ({ value: health, label: t(`filter.${health}`, { n: num(healthCounts[health]) }) })),
  ];

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('list.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('list.subtitle')}</p>
      </div>

      {/* Hàng lọc: ô tìm giãn hết chỗ trống, ô lọc tình trạng bên phải; dưới là sắp xếp + Hủy lọc (cùng mẫu bảng Thu hoạch) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[12rem] flex-1">
            <SearchInput placeholder={t('list.search')} value={search} onChange={setSearch} />
          </div>
          <SelectMenu ariaLabel={t('filter.label')} value={healthFilter} onChange={setHealthFilter} options={healthOptions} />
        </div>
        <div className="flex min-h-[2.25rem] flex-wrap items-center justify-between gap-2">
          <SortChips
            fields={[
              { key: 'name', label: t('sort.name') },
              { key: 'devices', label: t('sort.devices') },
              { key: 'faulty', label: t('sort.faulty') },
            ]}
            sortBy={sortKey}
            sortDir={sortDirection}
            onChange={handleSortChange}
          />
          {isFiltering && <ClearFiltersButton onClick={clearFilters} label={t('list.clearFilters')} count={activeFilterCount} tone="danger" />}
        </div>
      </div>

      {/* Khung bảng cùng chuẩn DataTable: viền warmGray/15, tiêu đề cột nền warmGray/5, dòng kẻ warmGray/10 */}
      <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
        <div className={cn('hidden border-b border-warmGray/15 bg-warmGray/5 px-4 py-3 label-caption', HOUSE_GRID)}>
          <span>{t('list.colHouse')}</span>
          <span>{t('list.colScale')}</span>
          <span>{t('list.colStatus')}</span>
          <span className="text-center">{t('list.colActions')}</span>
        </div>

        {items.length === 0 && (
          <div className="py-8">
            <TableEmptyState
              title={inventory.length === 0 ? t('list.noHouse') : t('list.emptyFiltered')}
              description={inventory.length === 0 ? undefined : t('list.emptyFilteredHint')}
            />
          </div>
        )}

        {items.map(item => {
          const isExpanded = (isSingleHouse || matchedInside.has(item.house._id)) !== toggledIds.has(item.house._id);
          const zoneCount = item.zoneGroups.length;
          const toggleLabel = t(isExpanded ? 'list.collapse' : 'list.expand', { house: item.house.name });
          const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggle(item.house._id);
          };
          return (
            // Đang xổ: viền xanh chanh vuông góc ôm cả hàng nhà yến lẫn phần xổ, khớp đường kẻ bảng
            <div
              key={item.house._id}
              className={cn('border-t border-warmGray/10 first:border-t-0 last:rounded-b-2xl', isExpanded && 'outline outline-2 -outline-offset-2 outline-accent-600')}
            >
              {/* Hàng nhà yến: bấm cả hàng để xổ / thu, không mở trang chi tiết; đang xổ thì nền xanh nhạt */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={toggleLabel}
                onClick={() => toggle(item.house._id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'flex cursor-pointer flex-col gap-2 px-4 py-4 transition-colors',
                  isExpanded ? 'bg-accent-50' : 'hover:bg-warmGray/5',
                  HOUSE_GRID,
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CaretDownIcon
                    size={16}
                    weight="bold"
                    className={cn('shrink-0 text-graphite transition-transform duration-200', isExpanded && 'rotate-180')}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-charcoal">{item.house.name}</p>
                    <p className="truncate text-xs text-warmGray">{farmName}</p>
                  </div>
                </div>
                <span className="pl-7 text-sm text-charcoal md:pl-0">
                  {t('list.scale', { zones: num(zoneCount), devices: num(item.tally.total) })}
                </span>
                <div className="pl-7 md:pl-0">
                  <HouseHealthPill tally={item.tally} />
                </div>
                <div className="pl-7 md:flex md:justify-center md:pl-0">
                  <button
                    type="button"
                    className={DETAIL_BUTTON_CLASS}
                    onClick={event => {
                      event.stopPropagation();
                      openDetail({ houseId: item.house._id });
                    }}
                  >
                    {t('action.detail')}
                  </button>
                </div>
              </div>

              {/* Thiết bị của nhà, chia theo Zone; camera cửa thu chim tính cho cả nhà */}
              {isExpanded && (
                <div className="flex flex-col gap-4 border-t border-warmGray/10 bg-warmGray/5 px-4 py-4">
                  {zoneCount === 0 && item.cameras.length === 0 && <p className="text-sm text-warmGray">{t('list.noZone')}</p>}
                  {item.zoneGroups.map(group => (
                    <DeviceGroup
                      key={group.zone._id}
                      title={group.zone.name}
                      devices={group.devices}
                      emptyText={t('list.zoneEmpty')}
                      onDetail={device => openDetail({ houseId: item.house._id, deviceId: device.id })}
                    />
                  ))}
                  {item.cameras.length > 0 && (
                    <DeviceGroup
                      title={t('list.cameraGroup')}
                      devices={item.cameras}
                      emptyText=""
                      onDetail={device => openDetail({ houseId: item.house._id, deviceId: device.id })}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface DeviceGroupProps {
  title: string;
  devices: DeviceItem[];
  emptyText: string;
  onDetail: (device: DeviceItem) => void;
}

// 1 nhóm thiết bị (1 Zone hoặc camera của cả nhà) trong phần xổ của hàng nhà yến: chỉ tên bộ kit và on/off, thông tin khác ở trang chi tiết
function DeviceGroup({ title, devices, emptyText, onDetail }: DeviceGroupProps): JSX.Element {
  const { t, num } = useTranslation(devicesDict);

  return (
    <div className="flex flex-col gap-2">
      <p className="label-caption text-graphite">
        {title} <span className="font-normal text-warmGray">· {t('list.zoneCount', { n: num(devices.length) })}</span>
      </p>
      {devices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-warmGray/30 bg-white px-4 py-3 text-sm text-warmGray">{emptyText}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-warmGray/15 bg-white">
          {devices.map(device => {
            const isSensor = device.type === 'sensor';
            return (
              <div key={device.id} className={cn('border-t border-warmGray/10 px-4 py-3 first:border-t-0', DEVICE_GRID)}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
                    {isSensor ? <CpuIcon size={18} /> : <VideoCameraIcon size={18} />}
                  </span>
                  <p className="truncate text-sm font-semibold text-charcoal">
                    {t(isSensor ? 'list.kitName' : 'list.cameraName', { id: device.deviceId })}
                  </p>
                </div>
                <StatusDot status={device.status} />
                <button type="button" className={DETAIL_BUTTON_CLASS} onClick={() => onDetail(device)}>
                  {t('action.detail')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
