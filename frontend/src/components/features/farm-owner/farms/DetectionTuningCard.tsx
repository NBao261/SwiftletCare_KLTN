import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { NO_VALUE } from '@/constants/display'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { cn } from '@/lib/cn'
import type { DetectionTuning } from '@/types'

// 5 tham số phát hiện theo Zone (swagger DetectionTuning): nhãn, đơn vị, số lẻ
const PARAMS: Array<{ key: keyof DetectionTuning; labelKey: FarmKey; hintKey: FarmKey; unit: string; decimals: number }> = [
  { key: 'noise_margin_db', labelKey: 'tuning.noiseMargin', hintKey: 'tuning.noiseMarginHint', unit: 'dB', decimals: 0 },
  { key: 'noise_min_sec', labelKey: 'tuning.noiseMinSec', hintKey: 'tuning.noiseMinSecHint', unit: 's', decimals: 0 },
  { key: 'pump_dry_on_sec', labelKey: 'tuning.pumpDryOn', hintKey: 'tuning.pumpDryOnHint', unit: 's', decimals: 0 },
  { key: 'pump_dry_min_rise_pct', labelKey: 'tuning.pumpDryRise', hintKey: 'tuning.pumpDryRiseHint', unit: '%RH', decimals: 1 },
  { key: 'speaker_drop_pct', labelKey: 'tuning.speakerDrop', hintKey: 'tuning.speakerDropHint', unit: '%', decimals: 0 },
]

// Tham số phát hiện của Zone (EXPERT-FR-008) — Domain Expert chỉnh, Farm Owner chỉ xem; chưa đặt thì "_"
export default function DetectionTuningCard({ tuning }: { tuning?: DetectionTuning }) {
  const { t, num } = useTranslation(farmDict)

  return (
    <FarmFrame title={t('tuning.title')} description={t('tuning.desc')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {PARAMS.map(param => {
          const value = tuning?.[param.key]
          return (
            <div key={param.key} className="rounded-2xl border border-warmGray/15 bg-white p-4">
              <p className="label-caption">{t(param.labelKey)}</p>
              <p className={cn('mt-2 text-2xl font-extrabold leading-none tracking-tight', value === undefined ? 'text-warmGray' : 'text-charcoal')}>
                {value === undefined ? NO_VALUE : num(value, param.decimals)}
                {value !== undefined && <span className="ml-1 text-xs font-medium text-warmGray">{param.unit === 's' ? t('tuning.seconds') : param.unit}</span>}
              </p>
              <p className="mt-1.5 text-[11px] font-medium text-warmGray">{t(param.hintKey)}</p>
            </div>
          )
        })}
      </div>
    </FarmFrame>
  )
}
