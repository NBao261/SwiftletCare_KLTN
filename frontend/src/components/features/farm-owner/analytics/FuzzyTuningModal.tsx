import { useState, type FormEvent } from 'react';

import { Button, Input, Modal, Toggle } from '@/components/ui';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useTuningSuggestion } from '@/hooks/farm-owner/useAnalytics';
import { useUpdateFuzzyTuning } from '@/hooks/shared/useFarms';
import { useToastStore } from '@/stores/toastStore';
import { parseThresholdInput } from '@/validations/common/threshold.validation';
import { FUZZY_TUNING_LIMITS, validateFuzzyTuning } from '@/validations/common/fuzzyTuning.validation';
import type { FuzzyNumericKey, FuzzyTuning } from '@/types';

// 4 hệ số số học của bộ điều khiển mờ, nhãn và gợi ý lấy từ từ điển
const FIELDS = [
  { key: 'fuzzy_humidity_band', labelKey: 'fuzzy.humidityBand', hintKey: 'fuzzy.humidityBandHint', step: '0.5' },
  { key: 'fuzzy_temp_band', labelKey: 'fuzzy.temperatureBand', hintKey: 'fuzzy.temperatureBandHint', step: '0.5' },
  { key: 'fuzzy_fan_dry_level', labelKey: 'fuzzy.fanDryLevel', hintKey: 'fuzzy.fanDryLevelHint', step: '5' },
  { key: 'fuzzy_window_sec', labelKey: 'fuzzy.window', hintKey: 'fuzzy.windowHint', step: '10' },
] as const satisfies ReadonlyArray<{ key: FuzzyNumericKey; labelKey: string; hintKey: string; step: string }>;

type TuningForm = Record<FuzzyNumericKey, string> & { fuzzy_input_filter: boolean };

// Đổi hệ số đang áp dụng sang giá trị form (chuỗi để ô số nhập tự do)
function toForm(tuning: FuzzyTuning): TuningForm {
  return {
    fuzzy_humidity_band: String(tuning.fuzzy_humidity_band),
    fuzzy_temp_band: String(tuning.fuzzy_temp_band),
    fuzzy_fan_dry_level: String(tuning.fuzzy_fan_dry_level),
    fuzzy_window_sec: String(tuning.fuzzy_window_sec),
    fuzzy_input_filter: tuning.fuzzy_input_filter,
  };
}

interface FuzzyTuningModalProps {
  zoneId: string;
  zoneName: string;
  current: FuzzyTuning;
  onClose: () => void;
}

// Popup chỉnh 4 hệ số và cờ lọc nhiễu của bộ điều khiển mờ (ENV-FR-021/022), lưu xong backend đẩy xuống ESP32
export default function FuzzyTuningModal({ zoneId, zoneName, current, onClose }: FuzzyTuningModalProps): JSX.Element {
  const { t } = useTranslation(analyticsDict);
  const updateTuning = useUpdateFuzzyTuning(zoneId);
  const suggestion = useTuningSuggestion(zoneId);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [form, setForm] = useState<TuningForm>(() => toForm(current));
  const [errors, setErrors] = useState<Partial<Record<FuzzyNumericKey, string>>>({});

  // Câu lỗi của 1 ô theo ngôn ngữ đang chọn (validator dùng chung chỉ báo ô nào sai)
  function fieldError(key: FuzzyNumericKey, value: number): string {
    const limit = FUZZY_TUNING_LIMITS[key];
    if (!Number.isFinite(value)) return t('fuzzy.errorNumber');
    if (value < limit.min || value > limit.max) return t('fuzzy.errorRange', { min: limit.min, max: limit.max });
    return t('fuzzy.errorInteger');
  }

  // Gợi ý hệ số (ANALYTICS-FR-010) chỉ điền sẵn vào form, người dùng vẫn phải bấm lưu
  async function handleSuggest(): Promise<void> {
    const { data } = await suggestion.refetch();
    const suggested = data?.suggestion;
    if (!suggested) return;
    setForm(previous => {
      const next = { ...previous };
      for (const field of FIELDS) {
        const value = suggested[field.key];
        if (value !== undefined) next[field.key] = String(value);
      }
      return next;
    });
    setErrors({});
  }

  function handleSave(event: FormEvent): void {
    event.preventDefault();
    const values: FuzzyTuning = {
      ...current,
      fuzzy_humidity_band: parseThresholdInput(form.fuzzy_humidity_band),
      fuzzy_temp_band: parseThresholdInput(form.fuzzy_temp_band),
      fuzzy_fan_dry_level: parseThresholdInput(form.fuzzy_fan_dry_level),
      fuzzy_window_sec: parseThresholdInput(form.fuzzy_window_sec),
      fuzzy_input_filter: form.fuzzy_input_filter,
    };
    const invalidKeys = Object.keys(validateFuzzyTuning(values)) as FuzzyNumericKey[];
    const foundErrors: Partial<Record<FuzzyNumericKey, string>> = {};
    for (const key of invalidKeys) foundErrors[key] = fieldError(key, values[key]);
    setErrors(foundErrors);
    if (invalidKeys.length > 0) return;

    // Chỉ gửi hệ số đã đổi để lịch sử chỉnh (vạch mốc trên biểu đồ) ghi đúng phần thay đổi
    const changed: Partial<FuzzyTuning> = {};
    for (const field of FIELDS) {
      if (values[field.key] !== current[field.key]) changed[field.key] = values[field.key];
    }
    if (values.fuzzy_input_filter !== current.fuzzy_input_filter) changed.fuzzy_input_filter = values.fuzzy_input_filter;
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    updateTuning.mutate(changed, {
      onSuccess: () => {
        push(t('fuzzy.saved'));
        onClose();
      },
      onError: error => push(apiErrorMessage(error, t('fuzzy.saveFailed')), 'error'),
    });
  }

  function handleReset(): void {
    setForm(toForm(DEFAULT_FUZZY_TUNING));
    setErrors({});
  }

  const suggestionData = suggestion.data;

  return (
    <Modal open onClose={onClose} title={t('fuzzy.title', { zone: zoneName })} size="lg">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Khối gợi ý hệ số từ mô hình */}
        <div className="flex flex-col gap-2 rounded-2xl border border-warmGray/15 bg-warmGray/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-small text-warmGray">{t('fuzzy.suggestHint')}</p>
            <Button type="button" size="sm" variant="secondary" loading={suggestion.isFetching} onClick={() => void handleSuggest()}>
              {t('fuzzy.suggest')}
            </Button>
          </div>
          {suggestion.isError && <p className="text-small text-alertRed">{apiErrorMessage(suggestion.error, t('fuzzy.suggestFailed'))}</p>}
          {suggestionData?.suggestion && (
            <p className="text-small text-charcoal">
              {t('fuzzy.suggestFilled', {
                r2: suggestionData.model?.r2 ?? NO_VALUE,
                days: suggestionData.model?.days ?? NO_VALUE,
                inRangeNow: suggestionData.predicted?.inRangeNow ?? NO_VALUE,
                inRangeSuggested: suggestionData.predicted?.inRangeSuggested ?? NO_VALUE,
                mistingNow: suggestionData.predicted?.mistingNow ?? NO_VALUE,
                mistingSuggested: suggestionData.predicted?.mistingSuggested ?? NO_VALUE,
              })}
            </p>
          )}
          {suggestionData && !suggestionData.suggestion && (
            <p className="text-small text-warmGray">{t('fuzzy.noSuggestion', { reason: suggestionData.reason ?? NO_VALUE })}</p>
          )}
        </div>

        {/* 4 ô hệ số */}
        {FIELDS.map(field => (
          <div key={field.key} className="flex flex-col gap-1">
            <Input
              label={t(field.labelKey)}
              type="number"
              step={field.step}
              min={FUZZY_TUNING_LIMITS[field.key].min}
              max={FUZZY_TUNING_LIMITS[field.key].max}
              value={form[field.key]}
              error={errors[field.key]}
              onChange={event => setForm(previous => ({ ...previous, [field.key]: event.target.value }))}
            />
            <p className="text-small text-warmGray">
              {t(field.hintKey)}{' '}
              {t('fuzzy.defaultRange', {
                default: DEFAULT_FUZZY_TUNING[field.key],
                min: FUZZY_TUNING_LIMITS[field.key].min,
                max: FUZZY_TUNING_LIMITS[field.key].max,
              })}
            </p>
          </div>
        ))}

        {/* Cờ lọc nhiễu đầu vào */}
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-warmGray/15 p-3">
          <div>
            <p className="label-caption">{t('fuzzy.filterTitle')}</p>
            <p className="mt-1 text-small text-warmGray">{t('fuzzy.filterHint')}</p>
          </div>
          <Toggle
            checked={form.fuzzy_input_filter}
            onChange={checked => setForm(previous => ({ ...previous, fuzzy_input_filter: checked }))}
            aria-label={t('fuzzy.filterTitle')}
          />
        </div>

        <p className="text-small text-warmGray">{t('fuzzy.footer')}</p>

        {/* Chân popup: về mặc định bên trái, huỷ và lưu bên phải */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warmGray/15 pt-4">
          <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
            {t('fuzzy.reset')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {t('fuzzy.cancel')}
            </Button>
            <Button type="submit" size="sm" loading={updateTuning.isPending}>
              {t('fuzzy.save')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
