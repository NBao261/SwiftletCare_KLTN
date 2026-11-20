import SelectMenu from '@/components/ui/SelectMenu';
import { cn } from '@/lib/cn';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { ScopeFilterState } from '@/hooks/shared/useScopeFilter';

interface ScopeFilterProps {
  scope: ScopeFilterState;
  // Trang chỉ tính theo nhà (VD Giám sát đàn chim): ô Zone luôn khoá xám ở "Tất cả Zone"
  lockZone?: boolean;
  // Trang chỉ tính theo trang trại (VD Tổng quan trại): ô Nhà và ô Zone luôn khoá
  lockHouse?: boolean;
}

// Ô khoá: nền xám, không bấm được
const LOCKED_CLASS = 'cursor-not-allowed border-warmGray/15 bg-warmGray/10 text-warmGray hover:border-warmGray/15';

// Khung lọc Trang trại → Nhà → Zone luôn đủ 3 ô (ô chưa chọn được khoá xám), chấm cam ở farm / nhà / Zone có sự cố
export default function ScopeFilter({ scope, lockZone = false, lockHouse = false }: ScopeFilterProps): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  const isHouseLocked = lockHouse || !scope.farmId;
  const isZoneLocked = lockHouse || lockZone || !scope.houseId;
  const hasHouseIssue = scope.houses.some(house => scope.issueHouseIds.has(house._id));
  const hasZoneIssue = scope.zones.some(zone => scope.issueZoneIds.has(zone._id));

  // Trang cần một trang trại / nhà / Zone (C-05): bỏ mục "Tất cả" của bậc đó, useScopeFilter đã tự chọn sẵn
  const needsFarm = scope.level !== 'none';
  const needsHouse = scope.level === 'house' || scope.level === 'zone';
  const needsZone = scope.level === 'zone';
  const farmOptions = [
    ...(needsFarm ? [] : [{ value: '', label: t('scope.allFarms') }]),
    ...scope.farms.map(farm => ({ value: farm._id, label: farm.name, warning: scope.issueFarmIds.has(farm._id) })),
  ];
  const houseOptions = [
    ...(needsHouse && !isHouseLocked ? [] : [{ value: '', label: t('page.allHouses'), warning: isHouseLocked && hasHouseIssue }]),
    ...(isHouseLocked ? [] : scope.houses).map(house => ({ value: house._id, label: house.name, warning: scope.issueHouseIds.has(house._id) })),
  ];
  const zoneOptions = [
    ...(needsZone && !isZoneLocked ? [] : [{ value: '', label: t('scope.allZones'), warning: isZoneLocked && hasZoneIssue }]),
    ...(isZoneLocked ? [] : scope.zones).map(zone => ({ value: zone._id, label: zone.name, warning: scope.issueZoneIds.has(zone._id) })),
  ];

  return (
    <div
      role="group"
      aria-label={t('scope.filterLabel')}
      className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-warmGray/15 bg-white/80 p-1 shadow-icon max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:rounded-3xl"
    >
      <SelectMenu
        ariaLabel={t('scope.farmLabel')}
        value={scope.farmId}
        options={farmOptions}
        onChange={scope.setFarmId}
        warningLabel={t('scope.warning')}
        className="h-9 w-44 justify-between max-sm:col-span-2 max-sm:w-full"
      />
      <SelectMenu
        ariaLabel={t('page.houseLabel')}
        value={isHouseLocked ? '' : scope.houseId}
        options={houseOptions}
        onChange={scope.setHouseId}
        warningLabel={t('scope.warning')}
        disabled={isHouseLocked}
        className={cn('h-9 w-40 justify-between max-sm:w-full', isHouseLocked && LOCKED_CLASS)}
      />
      <SelectMenu
        ariaLabel={t('scope.zoneLabel')}
        value={isZoneLocked ? '' : scope.zone?._id ?? ''}
        options={zoneOptions}
        onChange={scope.setZoneId}
        warningLabel={t('scope.warning')}
        disabled={isZoneLocked}
        className={cn('h-9 w-36 justify-between max-sm:w-full', isZoneLocked && LOCKED_CLASS)}
      />
    </div>
  );
}
