import { NEST_TYPE_BADGE_CLASS, NEST_TYPE_FILL_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { LEVEL_BADGE_SIZE } from '@/constants/severity';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { NestType } from '@/types';

// Loại yến của 1 lần thu: 1 loại → badge có tên; từ 2 loại → mỗi loại có 1 chấm tròn màu, xếp trái sang phải theo thứ tự trắng → hồng → huyết
export default function NestTypeStatus({ nestTypes }: { nestTypes: NestType[] }): JSX.Element {
  const { t } = useTranslation(harvestDict);
  const labels = nestTypes.map(nestType => t(`nestType.${nestType}`)).join(', ');

  if (nestTypes.length === 1) {
    return (
      // Cùng bo tròn và cỡ với badge trạng thái chung (FE_Design 1.1)
      <span className={cn('inline-flex items-center rounded-full font-medium', LEVEL_BADGE_SIZE, NEST_TYPE_BADGE_CLASS[nestTypes[0]])}>
        {labels}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={labels}
      title={labels}
      className="inline-flex items-center gap-1.5"
    >
      {nestTypes.map(nestType => <span key={nestType} className={cn('h-4 w-4 rounded-full', NEST_TYPE_FILL_CLASS[nestType])} />)}
    </span>
  );
}
