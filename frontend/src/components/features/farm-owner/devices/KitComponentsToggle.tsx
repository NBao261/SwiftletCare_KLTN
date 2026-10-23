import { useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

import ZoneComponentLog from '@/components/features/farm-owner/devices/ZoneComponentLog';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { COMPONENT_KINDS } from '@/components/features/farm-owner/devices/zoneComponents';
import type { CreateSupportDefaults } from '@/components/features/farm-owner/tickets/CreateSupportTicketModal';
import type { Thresholds } from '@/types';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';

interface KitComponentsToggleProps {
  zoneId: string;
  farmId: string;
  nodes: DeviceItem[];
  thresholds?: Thresholds;
  // Mở từ "Chi tiết" của bộ kit này thì xổ sẵn; mở từ "Chi tiết" của nhà thì thu gọn
  defaultOpen: boolean;
  onReport: (defaults: CreateSupportDefaults) => void;
}

// Bảng thiết bị của bộ kit (cảm biến, loa, relay): đầu bảng là hàng bấm để xổ / thu, tránh trang chi tiết quá dài
export default function KitComponentsToggle({ zoneId, farmId, nodes, thresholds, defaultOpen, onReport }: KitComponentsToggleProps): JSX.Element | null {
  const { t, num } = useTranslation(devicesDict);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sensorNodeCount = nodes.filter(node => node.type === 'sensor').length;
  if (sensorNodeCount === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-semibold text-charcoal">{t('component.toggleTitle')}</span>
          <span className="text-xs text-warmGray">{t('component.toggleCount', { n: num(COMPONENT_KINDS.length * sensorNodeCount) })}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-charcoal">
          {isOpen ? t('component.hide') : t('component.show')}
          <CaretDownIcon size={12} weight="bold" className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
        </span>
      </button>
      {/* Chỉ dựng khi đã xổ; số đo chỉ tải khi bấm Kiểm tra thiết bị */}
      {isOpen && (
        <div className="border-t border-gray-200">
          <ZoneComponentLog zoneId={zoneId} farmId={farmId} nodes={nodes} thresholds={thresholds} onReport={onReport} />
        </div>
      )}
    </div>
  );
}
