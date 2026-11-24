import { LinkSimpleBreakIcon, LinkSimpleIcon } from '@phosphor-icons/react';

import SelectMenu from '@/components/ui/SelectMenu';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import type { AllZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';

// Khung còn lại trong cặp liên kết Zone
export type ZoneLinkPartner = 'env' | 'control';

interface ZoneScopeControlProps {
  zones: AllZone[];
  value: string;
  onChange: (zoneId: string) => void;
  // Zone đang vượt ngưỡng hoặc có thiết bị hư
  issueZoneIds: Set<string>;
  isLinked: boolean;
  onToggleLink: () => void;
  partner: ZoneLinkPartner;
}

// Ô chọn Zone của 1 khung, dính liền nút liên kết để khung Cảm biến và khung Điều khiển xem cùng 1 Zone
export default function ZoneScopeControl({
  zones,
  value,
  onChange,
  issueZoneIds,
  isLinked,
  onToggleLink,
  partner,
}: ZoneScopeControlProps): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  const options = zones.map(zone => ({ value: zone._id, label: zone.name, warning: issueZoneIds.has(zone._id) }));
  const partnerName = partner === 'env' ? t('scope.panelEnv') : t('scope.panelControl');
  const linkHint = isLinked ? t('scope.linkOn', { panel: partnerName }) : t('scope.linkOff', { panel: partnerName });
  const LinkIcon = isLinked ? LinkSimpleIcon : LinkSimpleBreakIcon;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <SelectMenu
        ariaLabel={t('scope.zoneLabel')}
        value={value}
        options={options}
        onChange={onChange}
        warningLabel={t('scope.warning')}
        highlightFiltered={false}
        disabled={zones.length <= 1}
        className="h-9 w-40 justify-between"
      />

      {/* Nút liên kết Zone giữa 2 khung, chỉ có nghĩa khi nhà yến có từ 2 Zone */}
      {zones.length > 1 && (
        <button
          type="button"
          aria-pressed={isLinked}
          aria-label={linkHint}
          title={linkHint}
          onClick={onToggleLink}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
            isLinked
              ? 'border-charcoal bg-charcoal text-white hover:bg-graphite'
              : 'border-warmGray/25 bg-white text-warmGray hover:border-warmGray/50 hover:text-charcoal',
          )}
        >
          <LinkIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

