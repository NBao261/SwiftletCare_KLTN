import { NEST_TYPE_BADGE_CLASS, NEST_TYPE_FILL_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants';
import { LEVEL_BADGE_SIZE } from '@/constants/severity';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { NestType } from '@/types';

// 1 loại thì badge có tên, nhiều loại thì mỗi loại 1 chấm màu kèm tên
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

  // Nhiều loại: chấm màu kèm tên từng loại, không chỉ dựa vào màu
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-small text-charcoal">
      {nestTypes.map(nestType => (
        <span key={nestType} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn('h-2.5 w-2.5 rounded-full', NEST_TYPE_FILL_CLASS[nestType])} />
          {t(`nestType.${nestType}`)}
        </span>
      ))}
    </span>
  );
}
