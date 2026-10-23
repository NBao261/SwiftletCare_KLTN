import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ConfirmModal, EmptyState, LoadingSkeleton } from '@/components/ui';
import HarvestDetailModal from '@/components/features/farm-owner/harvest/HarvestDetailModal';
import HarvestStatsCards from '@/components/features/farm-owner/harvest/HarvestStatsCards';
import HarvestFormModal from '@/components/features/farm-owner/harvest/HarvestFormModal';
import HarvestTable from '@/components/features/farm-owner/harvest/HarvestTable';
import HarvestYearChart from '@/components/features/farm-owner/harvest/HarvestYearChart';
import NestTypeBreakdownCard from '@/components/features/farm-owner/harvest/NestTypeBreakdownCard';
import { environmentSummary, groupHarvests } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict, type HarvestTranslate } from '@/constants/harvest.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeleteHarvest, useHarvests } from '@/hooks/farm-owner/useHarvests';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useFarmDetails } from '@/hooks/shared/useFarms';
import { formatStandardDate } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { HarvestGroup } from '@/components/features/farm-owner/harvest/harvestMetrics';
import type { Farm, HarvestBatch, User } from '@/types';
import { NO_VALUE } from '@/constants/display';

// Ký tự BOM để Excel mở file CSV tiếng Việt đúng bảng mã
const CSV_BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// Tên người theo id: người đang đăng nhập, chủ farm và thành viên farm (đã có tên trong GET /farms/:id)
function buildPersonNames(farms: Farm[], user: User | null): Map<string, string> {
  const names = new Map<string, string>();
  for (const farm of farms) {
    for (const member of farm.members ?? []) {
      if (member.full_name) names.set(member.user_id, member.full_name);
    }
    if (farm.owner?.full_name) names.set(farm.owner_id, farm.owner.full_name);
  }
  if (user) names.set(user._id, user.full_name);
  return names;
}

// Xuất danh sách đợt thu ra CSV theo ngôn ngữ đang chọn, kèm nhiệt/ẩm TB 7 ngày trước thu
function exportCsv(batches: HarvestBatch[], houseNameByZone: Map<string, string>, personNames: Map<string, string>, translate: HarvestTranslate): void {
  const header = [
    translate('col.date'), translate('col.house'), translate('col.creator'), translate('col.nestType'), translate('form.nests'),
    translate('csv.weight'), translate('csv.temperature'), translate('csv.humidity'),
  ];
  const rows = batches.map(batch => {
    const environment = environmentSummary(batch.env_snapshot);
    return [
      formatStandardDate(batch.harvest_date),
      houseNameByZone.get(batch.zone_id) ?? '',
      (batch.created_by && personNames.get(batch.created_by)) ?? '',
      translate(`nestType.${batch.nest_type}`),
      String(batch.nest_count),
      String(batch.weight_grams),
      environment ? String(environment.temperature) : '',
      environment ? String(environment.humidity) : '',
    ];
  });
  const csv = [header, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([CSV_BYTE_ORDER_MARK + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `thu-hoach-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Trang Thu hoạch của Farm Owner — chỉ ghi nhận thu hoạch theo SRS v2 (MARKET-FR-001..005, Flow 7)
export default function FarmOwnerHarvestPage(): JSX.Element {
  const { t } = useTranslation(harvestDict);
  // Khung lọc Trang trại → Nhà → Zone chung các trang Farm Owner, lưu lại khi chuyển trang
  // Sản lượng nhập theo nhà yến nên trang chỉ lọc tới nhà: ô Zone khoá, bỏ Zone đã lưu ở trang khác
  const scope = { ...useScopeFilter(), zone: undefined };
  const farmId = scope.farmId;
  // Đợt thu của farm đang lọc, hoặc của mọi farm khi xem tất cả trang trại
  const { data: batches, isLoading, isError, error, refetch } = useHarvests(farmId || undefined);
  const zones = scope.zones;
  const detailFarmIds = useMemo(() => (farmId ? [farmId] : scope.farms.map(farm => farm._id)), [farmId, scope.farms]);
  const farmDetails = useFarmDetails(detailFarmIds);
  const user = useAuthStore(state => state.user);
  const deleteHarvest = useDeleteHarvest();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // Khoá lần thu (nhóm các loại yến) đang mở chi tiết / sửa / chờ xoá
  const [detailGroupKey, setDetailGroupKey] = useState<string | null>(null);
  const [editGroupKey, setEditGroupKey] = useState<string | null>(null);
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Backend lưu lần thu theo Zone; giao diện chỉ hiện nhà yến của Zone đó
  const houseNameByZone = useMemo(() => new Map((zones ?? []).map(zone => [zone._id, zone.houseName])), [zones]);
  const personNames = useMemo(() => buildPersonNames(farmDetails, user), [farmDetails, user]);
  // Đợt thu trong phạm vi đang lọc: các Zone của 1 nhà, hoặc cả farm / mọi farm
  const scopedBatches = useMemo(() => {
    const allFarmBatches = batches ?? [];
    if (!scope.houseId) return allFarmBatches;
    const scopeZoneIds = new Set(scope.zones.map(zone => zone._id));
    return allFarmBatches.filter(batch => scopeZoneIds.has(batch.zone_id));
  }, [batches, scope.houseId, scope.zones]);
  // Mỗi lần thu 1 nhóm: các loại yến ghi cùng lần gộp lại
  const groups = useMemo(() => groupHarvests(scopedBatches), [scopedBatches]);
  const groupByKey = useMemo(() => new Map(groups.map(group => [group.key, group])), [groups]);

  if (scope.farms.length === 0) {
    return (
      <EmptyState
        title={t('page.noFarmTitle')}
        description={t('page.noFarmDesc')}
        action={
          <Link to="/farms">
            <Button>{t('page.goFarms')}</Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return <LoadingSkeleton count={3} className="h-28 w-full" />;
  }

  if (isError) {
    return (
      <EmptyState
        title={t('page.errorTitle')}
        description={apiErrorMessage(error)}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
      />
    );
  }

  const allBatches = scopedBatches;
  // Người nhập 1 lần thu = người tạo đợt đầu; không tra được tên (VD Admin nhập hộ) thì "_"
  const creatorName = (group: HarvestGroup): string => {
    const creatorId = group.batches[0]?.created_by;
    return (creatorId && personNames.get(creatorId)) || NO_VALUE;
  };
  // Phạm vi đang lọc chưa có Zone nào (VD nhà mới tạo) thì chặn ghi đợt thu, nói rõ lý do
  const createBlockedReason = scope.zones.length > 0 ? undefined
    : scope.houseId ? t('page.blockedHouse', { house: scope.houseName }) : t('page.blockedFarm');
  const detailGroup = detailGroupKey ? groupByKey.get(detailGroupKey) : undefined;
  const editGroup = editGroupKey ? groupByKey.get(editGroupKey) : undefined;

  // Xoá cả lần thu = xoá đợt của từng loại yến trong nhóm
  async function handleDelete(): Promise<void> {
    const group = deleteGroupKey ? groupByKey.get(deleteGroupKey) : undefined;
    if (!group) return;
    setIsDeleting(true);
    const results = await Promise.allSettled(group.batches.map(batch => deleteHarvest.mutateAsync(batch._id)));
    setIsDeleting(false);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failure) {
      push(apiErrorMessage(failure.reason, t('delete.failed')), 'error');
      return;
    }
    push(t('delete.done'));
    setDeleteGroupKey(null);
    setDetailGroupKey(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Khung lọc nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} lockZone />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} lockZone />
      </div>

      <HarvestStatsCards
        groups={groups}
        zones={zones}
        farmNames={scope.farmNames}
      />

      {/* Bảng lần thu bên trái (8/12), phân bổ theo loại tổ bên phải (4/12); màn xl khoá cứng chiều cao 2 khung (556px), màn hẹp xếp chồng */}
      {/* Hàng lưới đặt cứng minmax(0,1fr): nội dung dài không kéo hàng cao quá 556px, bảng tự cuộn bên trong */}
      <div className="grid grid-cols-1 gap-6 xl:h-[556px] xl:grid-cols-12 xl:grid-rows-[minmax(0,1fr)]">
        <div className="min-w-0 xl:col-span-8 xl:h-full xl:min-h-0">
          <HarvestTable
            groups={groups}
            zones={scope.zones}
            houses={scope.houseId ? [] : scope.houses}
            creatorName={creatorName}
            onOpenDetail={group => setDetailGroupKey(group.key)}
            onEdit={group => setEditGroupKey(group.key)}
            onDelete={group => setDeleteGroupKey(group.key)}
            onCreate={() => setIsCreateOpen(true)}
            createBlockedReason={createBlockedReason}
            onExport={() => exportCsv(allBatches, houseNameByZone, personNames, t)}
          />
        </div>
        <div className="min-w-0 xl:col-span-4 xl:h-full xl:min-h-0">
          <NestTypeBreakdownCard batches={allBatches} />
        </div>
      </div>

      <HarvestYearChart batches={allBatches} />

      {/* Popup chỉ dựng khi mở nên mỗi lần mở là form mới */}
      {isCreateOpen && !createBlockedReason && <HarvestFormModal scope={scope} creatorName={user?.full_name ?? NO_VALUE} onClose={() => setIsCreateOpen(false)} />}

      {detailGroup && (
        <HarvestDetailModal
          group={detailGroup}
          houseName={houseNameByZone.get(detailGroup.zone_id) ?? NO_VALUE}
          creatorName={creatorName(detailGroup)}
          onClose={() => setDetailGroupKey(null)}
          onEdit={group => {
            setDetailGroupKey(null);
            setEditGroupKey(group.key);
          }}
          onDelete={group => setDeleteGroupKey(group.key)}
        />
      )}

      {editGroup && (
        <HarvestFormModal
          scope={scope}
          group={editGroup}
          houseName={houseNameByZone.get(editGroup.zone_id) ?? NO_VALUE}
          creatorName={creatorName(editGroup)}
          onClose={() => setEditGroupKey(null)}
        />
      )}

      <ConfirmModal
        open={deleteGroupKey !== null}
        title={t('delete.title')}
        description={t('delete.description')}
        confirmLabel={t('delete.confirm')}
        danger
        loading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteGroupKey(null)}
      />
    </div>
  );
}
