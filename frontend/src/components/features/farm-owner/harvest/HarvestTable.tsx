import { useMemo, useState } from 'react';
import { WarningCircleIcon } from '@phosphor-icons/react';

import TableEmptyState from '@/components/common/TableEmptyState';
import { Badge, Button, FilterChip, SelectMenu, type DataTableColumn } from '@/components/ui';
import ActionsMenu from '@/components/ui/ActionsMenu';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import NestTypeStatus from '@/components/features/farm-owner/harvest/NestTypeStatus';
import { KILOGRAM_DIGITS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import type { HarvestGroup } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { FlatZone } from '@/hooks/shared/useFarms';
import { formatStandardDate } from '@/lib/i18n';
import type { NestType } from '@/types';
import { NO_VALUE } from '@/constants/display';

// Cùng chiều cao dòng các bảng khác của Farm Owner
const ROW_HEIGHT = 68;
const GRAMS_PER_KILOGRAM = 1000;

interface HarvestTableProps {
  groups: HarvestGroup[];
  // Zone trong phạm vi, để tra nhà yến của từng lần thu (backend lưu lần thu theo Zone)
  zones: FlatZone[] | undefined;
  // Tên người tạo lần thu
  creatorName: (group: HarvestGroup) => string;
  onOpenDetail: (group: HarvestGroup) => void;
  // Không truyền (Domain Expert chỉ đọc) thì ẩn sửa, xoá
  onEdit?: (group: HarvestGroup) => void;
  onDelete?: (group: HarvestGroup) => void;
  // Lần thu nào được sửa, xoá (Kỹ thuật viên: chỉ lần chưa xác nhận của mình); mặc định mọi lần
  canChange?: (group: HarvestGroup) => boolean;
  // Chỉ Farm Owner: xác nhận các lô DRAFT của lần thu
  onConfirm?: (group: HarvestGroup) => void;
  // Có thì hiện lý do chưa ghi được đợt thu (phạm vi đang lọc chưa có Zone)
  createBlockedReason?: string;
  // Có thể ghi đợt thu: để chữ rỗng nhắc bấm "Ghi đợt thu hoạch"
  canCreate: boolean;
}

// Bảng lần thu: lọc theo loại tổ và "chờ xác nhận"; nhà yến đã chọn ở bộ lọc trên header; bấm cả dòng để mở chi tiết
export default function HarvestTable({
  groups, zones, creatorName, onOpenDetail, onEdit, onDelete, canChange = () => true, onConfirm, createBlockedReason, canCreate,
}: HarvestTableProps): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const [nestTypeFilter, setNestTypeFilter] = useState<NestType | ''>('');
  const [isPendingOnly, setIsPendingOnly] = useState(false);

  const zoneById = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone])), [zones]);
  const pendingCount = useMemo(() => groups.filter(group => group.pendingIds.length > 0).length, [groups]);

  // Mới nhất lên đầu; lọc loại tổ giữ lần thu có loại đó
  const rows = useMemo(() => groups
    .filter(group => (!nestTypeFilter || group.nestTypes.includes(nestTypeFilter)) && (!isPendingOnly || group.pendingIds.length > 0))
    .sort((first, second) => new Date(second.harvest_date).getTime() - new Date(first.harvest_date).getTime()),
  [groups, nestTypeFilter, isPendingOnly]);
  const isFiltering = nestTypeFilter !== '' || isPendingOnly;

  const columns = useMemo<DataTableColumn<HarvestGroup>[]>(() => [
    {
      key: 'date', header: t('col.date'), className: 'w-[20%] whitespace-nowrap',
      render: group => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm font-semibold text-charcoal">{formatStandardDate(group.harvest_date)}</span>
          {group.pendingIds.length > 0 && <Badge tone="warning">{t('status.pending')}</Badge>}
        </div>
      ),
    },
    {
      key: 'house', header: t('col.house'), className: 'w-[20%]',
      render: group => <span className="block truncate text-sm font-semibold text-charcoal">{zoneById.get(group.zone_id)?.houseName ?? NO_VALUE}</span>,
    },
    { key: 'nestType', header: t('col.nestType'), className: 'w-[17%]', render: group => <NestTypeStatus nestTypes={group.nestTypes} /> },
    {
      key: 'yield', header: t('col.yield'), className: 'w-[15%] whitespace-nowrap',
      render: group => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-charcoal">{t('cell.nests', { n: num(group.nest_count) })}</span>
          <span className="text-xs text-warmGray">{t('cell.kilograms', { kg: num(group.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) })}</span>
        </div>
      ),
    },
    { key: 'creator', header: t('col.creator'), className: 'w-[16%]', render: group => <span className="block truncate text-sm text-charcoal">{creatorName(group)}</span> },
    // Một việc chính ngay trên dòng (xác nhận lần chờ); sửa, xoá nằm trong menu ⋯
    {
      key: 'actions', header: '', align: 'right', className: 'w-[12%] whitespace-nowrap',
      render: group => {
        const menuItems = canChange(group)
          ? [
            ...(onEdit ? [{ label: t('action.edit'), onClick: () => onEdit(group) }] : []),
            ...(onDelete ? [{ label: t('action.delete'), onClick: () => onDelete(group), danger: true }] : []),
          ]
          : [];
        const canConfirm = onConfirm !== undefined && group.pendingIds.length > 0;
        return (
          // Bấm nút hoặc menu không mở chi tiết của dòng
          <div className="flex items-center justify-end gap-1" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
            {canConfirm && <Button size="sm" onClick={() => onConfirm(group)}>{t('action.confirmShort')}</Button>}
            {menuItems.length > 0 && <ActionsMenu items={menuItems} />}
          </div>
        );
      },
    },
  ], [t, num, zoneById, creatorName, canChange, onEdit, onDelete, onConfirm]);

  const emptyTitle = t(isFiltering ? 'table.emptyFilteredTitle' : 'table.emptyTitle');
  const emptyHint = isFiltering ? t('table.emptyFilteredHint') : canCreate ? t('table.emptyHint') : undefined;

  return (
    <div className="flex flex-col gap-4">
      {createBlockedReason && (
        <p className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-small text-graphite" role="status">
          <WarningCircleIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" />
          {createBlockedReason}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu
          ariaLabel={t('table.filterNestType')}
          value={nestTypeFilter}
          onChange={setNestTypeFilter}
          options={[{ value: '' as const, label: t('table.allNestTypes') }, ...NEST_TYPES.map(nestType => ({ value: nestType, label: t(`nestType.${nestType}`) }))]}
        />
        {pendingCount > 0 && (
          <FilterChip active={isPendingOnly} label={`${t('status.pending')} ${num(pendingCount)}`} onClick={() => setIsPendingOnly(current => !current)} />
        )}
      </div>

      <FixedRowsTable
        columns={columns}
        rows={rows}
        getRowKey={group => group.key}
        onRowClick={onOpenDetail}
        rowHeight={ROW_HEIGHT}
        emptyNotice={emptyTitle}
        emptyContent={<TableEmptyState title={emptyTitle} description={emptyHint} />}
        mobileCard={group => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-charcoal">
                {formatStandardDate(group.harvest_date)} · {zoneById.get(group.zone_id)?.houseName ?? NO_VALUE}
              </p>
              {group.pendingIds.length > 0 && <Badge tone="warning">{t('status.pending')}</Badge>}
            </div>
            <NestTypeStatus nestTypes={group.nestTypes} />
            <p className="text-small text-warmGray">
              {t('cell.nests', { n: num(group.nest_count) })} · {t('cell.kilograms', { kg: num(group.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) })}
            </p>
            {/* Cùng nút xác nhận và menu với cột cuối */}
            {columns[columns.length - 1].render(group, 0)}
          </div>
        )}
      />
    </div>
  );
}
