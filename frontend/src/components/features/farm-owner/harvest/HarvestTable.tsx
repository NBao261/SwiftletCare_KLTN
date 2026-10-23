import { useMemo, useState } from 'react';
import { DownloadSimpleIcon, PlusIcon, WarningCircleIcon } from '@phosphor-icons/react';

import TableEmptyState from '@/components/common/TableEmptyState';
import {
  Button, Card, ClearFiltersButton, DataTable, SearchInput, SelectMenu, SortChips, type DataTableColumn,
} from '@/components/ui';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants';
import NestTypeStatus from '@/components/features/farm-owner/harvest/NestTypeStatus';
import { KILOGRAM_DIGITS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import type { HarvestGroup } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { cn } from '@/lib/cn';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { FlatZone } from '@/hooks/shared/useFarms';
import { formatStandardDate } from '@/lib/i18n';
import type { House, NestType, SortDirection } from '@/types';
import { NO_VALUE } from '@/constants/display';

// Màn hẹp: khung bảng cao cố định 4 dòng; màn xl: khung lấp chiều cao cố định của Card, dòng còn lại cuộn dọc
const VISIBLE_ROWS = 4;
const ROW_HEIGHT = 68;
// Tiêu đề cột (~46px) + 4 dòng × 68px — chiều cao cố định của vùng bảng khi chưa tới màn xl
const TABLE_AREA_CLASS = 'h-[318px] xl:h-auto xl:min-h-0 xl:flex-1';
// Bảng nằm trong cột 8/12 nên hạ bề rộng tối thiểu để không cuộn ngang ở màn rộng
const TABLE_MIN_WIDTH = 640;
// Ô đệm ngang hẹp hơn mặc định để 6 cột vừa cột 8/12
const CELL_PADDING = 'px-3';
const GRAMS_PER_KILOGRAM = 1000;
type SortKey = 'date' | 'weight';
const DEFAULT_SORT_KEY: SortKey = 'date';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

// Giá trị dùng để sắp xếp theo từng tiêu chí
const SORT_VALUE: Record<SortKey, (group: HarvestGroup) => number> = {
  date: group => new Date(group.harvest_date).getTime(),
  weight: group => group.weight_grams,
};

interface HarvestTableProps {
  groups: HarvestGroup[];
  // Zone trong phạm vi, để tra nhà yến của từng lần thu (backend lưu lần thu theo Zone)
  zones: FlatZone[] | undefined;
  // Nhà yến cho ô lọc; rỗng thì ẩn ô lọc (đã lọc 1 nhà ở khung trên)
  houses: House[];
  // Tên người tạo lần thu
  creatorName: (group: HarvestGroup) => string;
  onOpenDetail: (group: HarvestGroup) => void;
  onEdit: (group: HarvestGroup) => void;
  onDelete: (group: HarvestGroup) => void;
  onCreate: () => void;
  onExport: () => void;
  // Có thì khoá nút ghi đợt thu và hiện lý do (phạm vi đang lọc chưa có Zone)
  createBlockedReason?: string;
}

// Bảng lần thu (1 dòng 1 lần thu): tìm / lọc / sắp xếp ở client, khung 4 dòng cuộn dọc không bù dòng trống (ngoại lệ FE_Design 1.1)
export default function HarvestTable({ groups, zones, houses, creatorName, onOpenDetail, onEdit, onDelete, onCreate, onExport, createBlockedReason }: HarvestTableProps): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const [search, setSearch] = useState('');
  const [houseFilter, setHouseFilter] = useState('');
  const [nestTypeFilter, setNestTypeFilter] = useState<NestType | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  // Bấm lại đúng tiêu chí đang sắp thì đảo chiều, đổi tiêu chí thì về tăng dần
  function handleSortChange(key: string): void {
    if (key === sortKey) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key as SortKey);
    setSortDirection('asc');
  }

  // Số điều kiện lọc đang bật — hiện trên nút Hủy lọc
  const activeFilterCount = [search, houseFilter, nestTypeFilter].filter(value => value !== '').length
    + (sortKey !== DEFAULT_SORT_KEY || sortDirection !== DEFAULT_SORT_DIRECTION ? 1 : 0);
  const isFiltering = activeFilterCount > 0;

  function handleClearFilters(): void {
    setSearch('');
    setHouseFilter('');
    setNestTypeFilter('');
    setSortKey(DEFAULT_SORT_KEY);
    setSortDirection(DEFAULT_SORT_DIRECTION);
  }

  const zoneById = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone])), [zones]);

  // Lọc theo nhà yến, loại yến (giữ lần thu có loại đó) và tìm theo tên nhà
  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matched = groups.filter(group => {
      const zone = zoneById.get(group.zone_id);
      if (houseFilter && zone?.house_id !== houseFilter) return false;
      if (nestTypeFilter && !group.nestTypes.includes(nestTypeFilter)) return false;
      if (keyword && !(zone?.houseName ?? '').toLowerCase().includes(keyword)) return false;
      return true;
    });
    const direction = sortDirection === 'asc' ? 1 : -1;
    const value = SORT_VALUE[sortKey];
    return matched.sort((first, second) => (value(first) - value(second)) * direction);
  }, [groups, zoneById, houseFilter, nestTypeFilter, search, sortKey, sortDirection]);

  // Không hiện mã trace_code (mã định danh nội bộ của mẻ, FE_Design 13.16a)
  const columns: DataTableColumn<HarvestGroup>[] = [
    {
      key: 'date', header: t('col.date'), className: cn('w-[17%] whitespace-nowrap', CELL_PADDING),
      render: group => <span className="text-sm font-semibold text-charcoal">{formatStandardDate(group.harvest_date)}</span>,
    },
    {
      key: 'house', header: t('col.house'), className: cn('w-[16%]', CELL_PADDING),
      render: group => (
        <span className="block truncate text-sm font-semibold text-charcoal">{zoneById.get(group.zone_id)?.houseName ?? NO_VALUE}</span>
      ),
    },
    {
      key: 'nestType', header: t('col.nestType'), className: cn('w-[17%]', CELL_PADDING),
      render: group => <NestTypeStatus nestTypes={group.nestTypes} />,
    },
    {
      key: 'yield', header: t('col.yield'), className: cn('w-[15%]', CELL_PADDING),
      render: group => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-charcoal">{t('cell.nests', { n: num(group.nest_count) })}</span>
          <span className="mt-0.5 text-xs text-warmGray">{t('cell.kilograms', { kg: num(group.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) })}</span>
        </div>
      ),
    },
    {
      key: 'creator', header: t('col.creator'), className: cn('w-[21%]', CELL_PADDING),
      render: group => <span className="block truncate text-sm text-charcoal">{creatorName(group)}</span>,
    },
    {
      key: 'actions', header: t('col.actions'), align: 'center', className: cn('w-[14%] whitespace-nowrap', CELL_PADDING),
      render: group => (
        // Chặn click lan lên dòng để mở menu không mở luôn chi tiết
        <div onClick={event => event.stopPropagation()} className="flex items-center justify-center">
          <ActionsMenu
            items={[
              { label: t('action.detail'), onClick: () => onOpenDetail(group) },
              { label: t('action.edit'), onClick: () => onEdit(group) },
              { label: t('action.delete'), onClick: () => onDelete(group), danger: true },
            ]}
          />
        </div>
      ),
    },
  ];

  const houseOptions = [
    { value: '', label: t('table.allHouses') },
    ...houses.map(house => ({ value: house._id, label: house.name })),
  ];
  const nestTypeOptions: Array<{ value: NestType | ''; label: string }> = [
    { value: '', label: t('table.allNestTypes') },
    ...NEST_TYPES.map(nestType => ({ value: nestType, label: t(`nestType.${nestType}`) })),
  ];
  const emptyTitle = isFiltering ? t('table.emptyFilteredTitle') : t('table.emptyTitle');

  return (
    <Card size="lg" className="flex h-full min-h-0 flex-col gap-4">
      {/* Tiêu đề bên trái, nút Xuất dữ liệu + Ghi đợt thu bên phải — cùng mẫu đầu khung trang Trang trại */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">{t('table.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">{t('table.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={onExport} disabled={groups.length === 0}>
            <DownloadSimpleIcon size={14} weight="bold" />
            {t('page.export')}
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={onCreate} disabled={Boolean(createBlockedReason)} title={createBlockedReason}>
            <PlusIcon size={14} weight="bold" />
            {t('page.create')}
          </Button>
        </div>
      </div>

      {createBlockedReason && (
        <p className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-small text-graphite" role="status">
          <WarningCircleIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" />
          {createBlockedReason}
        </p>
      )}

      {/* Hàng lọc: ô tìm giãn hết chỗ trống, 2 ô lọc bên phải */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[12rem] flex-1">
            <SearchInput placeholder={t('table.search')} value={search} onChange={setSearch} />
          </div>
          {houses.length > 1 && (
            <SelectMenu ariaLabel={t('table.filterHouse')} value={houseFilter} onChange={setHouseFilter} options={houseOptions} />
          )}
          <SelectMenu ariaLabel={t('table.filterNestType')} value={nestTypeFilter} onChange={setNestTypeFilter} options={nestTypeOptions} />
        </div>
        {/* Hàng sắp xếp bên trái, nút Hủy lọc bên phải (chỉ hiện khi đang lọc) — giữ cao cố định để bảng không nhảy */}
        <div className="flex min-h-[2.25rem] flex-wrap items-center justify-between gap-2">
          <SortChips
            fields={[{ key: 'date', label: t('table.sortDate') }, { key: 'weight', label: t('table.sortWeight') }]}
            sortBy={sortKey}
            sortDir={sortDirection}
            onChange={handleSortChange}
          />
          {isFiltering && (
            <ClearFiltersButton onClick={handleClearFilters} label={t('table.clearFilters')} count={activeFilterCount} tone="danger" />
          )}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className={cn('flex items-center justify-center rounded-2xl border border-warmGray/15', TABLE_AREA_CLASS)}>
          <TableEmptyState title={emptyTitle} description={isFiltering ? t('table.emptyFilteredHint') : t('table.emptyHint')} />
        </div>
      ) : (
        <div className={TABLE_AREA_CLASS}>
          <DataTable
            columns={columns}
            rows={filteredGroups}
            getRowKey={group => group.key}
            onRowClick={onOpenDetail}
            rowHeight={ROW_HEIGHT}
            minTableWidth={TABLE_MIN_WIDTH}
            visibleRows={VISIBLE_ROWS}
            fillHeight
          />
        </div>
      )}
    </Card>
  );
}
