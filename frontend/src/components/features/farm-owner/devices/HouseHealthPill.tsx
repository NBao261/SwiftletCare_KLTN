import { houseHealthOf, type DeviceTally } from '@/components/features/farm-owner/devices/deviceInventory';
import { HEALTH_PILL_CLASS } from '@/components/features/farm-owner/devices/devices.constants';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';

// Pill tình trạng tổng hợp thiết bị của 1 nhà yến: Hoạt động tốt / n thiết bị lỗi / Chưa có thiết bị
export default function HouseHealthPill({ tally }: { tally: DeviceTally }): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const tone = houseHealthOf(tally);
  const label = tone === 'good' ? t('health.good') : tone === 'fault' ? t('health.fault', { n: num(tally.faulty) }) : t('health.empty');

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', HEALTH_PILL_CLASS[tone].pill)}>
        <span className={cn('h-2 w-2 rounded-full', HEALTH_PILL_CLASS[tone].dot)} />
        {label}
      </span>
      {tally.pending > 0 && <span className="whitespace-nowrap text-xs text-warmGray">{t('health.pending', { n: num(tally.pending) })}</span>}
    </span>
  );
}
