import SelectMenu from '@/components/ui/SelectMenu';
import { cn } from '@/lib/cn';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { ScopeFilterState } from '@/hooks/farm-owner/useScopeFilter';

interface ScopeFilterProps {
  scope: ScopeFilterState;
  // Trang chỉ tính theo nhà (VD Giám sát đàn chim, Thu hoạch): ô Zone luôn khoá xám ở "Tất cả Zone"
  lockZone?: boolean;
  // Zone đang vượt ngưỡng hoặc có thiết bị hư: chấm cam trong danh sách, "!" trên ô Zone
  issueZoneIds?: Set<string>;
}

// Khung lọc chung các trang Farm Owner: 1 khung bo tròn chứa ô Nhà và ô Zone; chọn nhà thì Zone mặc định "Tất cả Zone"
export default function ScopeFilter({ scope, lockZone = false, issueZoneIds }: ScopeFilterProps): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  const houseOptions = [
    { value: '', label: t('page.allHouses') },
    ...scope.houses.map(house => ({ value: house._id, label: house.name })),
  ];
  // Ô Zone khoá ở "Tất cả Zone" khi trang chỉ tính theo nhà hoặc đang chọn tất cả nhà
  const isZoneLocked = lockZone || !scope.houseId;
  const zoneOptions = [
    { value: '', label: t('scope.allZones') },
    ...(isZoneLocked ? [] : scope.zones).map(zone => ({ value: zone._id, label: zone.name, warning: issueZoneIds?.has(zone._id) })),
  ];

  return (
    <div
      role="group"
      aria-label={t('scope.filterLabel')}
      className="inline-flex items-center gap-1.5 rounded-full border border-warmGray/15 bg-white/80 p-1 shadow-icon"
    >
      <SelectMenu
        ariaLabel={t('page.houseLabel')}
        value={scope.houseId}
        options={houseOptions}
        onChange={scope.setHouseId}
        className="h-9 w-40 justify-between"
      />
      <SelectMenu
        ariaLabel={t('scope.zoneLabel')}
        value={isZoneLocked ? '' : scope.zone?._id ?? ''}
        options={zoneOptions}
        onChange={scope.setZoneId}
        warningLabel={t('scope.warning')}
        disabled={isZoneLocked}
        className={cn(
          'h-9 w-36 justify-between',
          isZoneLocked && 'cursor-not-allowed border-warmGray/15 bg-warmGray/10 text-warmGray hover:border-warmGray/15',
        )}
      />
    </div>
  );
}
