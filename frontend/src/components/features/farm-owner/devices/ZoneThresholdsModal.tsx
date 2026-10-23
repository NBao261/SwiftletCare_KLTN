import { useEffect, useState, type FormEvent } from 'react';

import { Button, Input, Modal } from '@/components/ui';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { THRESHOLD_KEYS } from '@/constants/thresholds';
import { devicesDict, type DevicesKey } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useResetThresholds, useUpdateThresholds, useZone } from '@/hooks/shared/useFarms';
import { useToastStore } from '@/stores/toastStore';
import type { Thresholds } from '@/types';

type FormValues = Record<keyof Thresholds, string>;

// Nhãn và bước nhập của từng ngưỡng; NH3, CO2 chỉ để cảnh báo (ENV-FR-006/011)
const FIELDS: Record<keyof Thresholds, { labelKey: DevicesKey; step: string }> = {
  temp_min: { labelKey: 'thr.tempMin', step: '0.1' },
  temp_max: { labelKey: 'thr.tempMax', step: '0.1' },
  humidity_min: { labelKey: 'thr.humidityMin', step: '0.1' },
  humidity_max: { labelKey: 'thr.humidityMax', step: '0.1' },
  light_max: { labelKey: 'thr.lightMax', step: '0.01' },
  nh3_max: { labelKey: 'thr.nh3Max', step: '1' },
  co2_max: { labelKey: 'thr.co2Max', step: '1' },
};

function toFormValues(thresholds: Thresholds): FormValues {
  return Object.fromEntries(THRESHOLD_KEYS.map(key => [key, String(thresholds[key])])) as FormValues;
}

// Kiểm số hợp lệ và cặp thấp nhất < cao nhất; khoảng đo của từng cảm biến do backend kiểm
function parseForm(values: FormValues): Thresholds | 'number' | 'pair' {
  const parsed = {} as Thresholds;
  for (const key of THRESHOLD_KEYS) {
    const value = Number(values[key]);
    if (values[key].trim() === '' || !Number.isFinite(value)) return 'number';
    parsed[key] = value;
  }
  if (parsed.temp_min >= parsed.temp_max || parsed.humidity_min >= parsed.humidity_max) return 'pair';
  return parsed;
}

interface ZoneThresholdsModalProps {
  zoneId: string;
  zoneName: string;
  onClose: () => void;
}

// Chỉnh 7 ngưỡng của 1 Zone và đặt lại mặc định hệ thống (ENV-FR-006, ENV-FR-020) — Farm Owner được làm
export default function ZoneThresholdsModal({ zoneId, zoneName, onClose }: ZoneThresholdsModalProps): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const { data: zone, isLoading } = useZone(zoneId);
  const updateThresholds = useUpdateThresholds(zoneId);
  const resetThresholds = useResetThresholds(zoneId);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [values, setValues] = useState<FormValues | null>(null);
  const [error, setError] = useState<DevicesKey | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Đổ ngưỡng hiện hành vào form khi tải xong Zone
  useEffect(() => {
    if (zone) setValues(toFormValues(zone.thresholds));
  }, [zone]);

  function handleSave(event: FormEvent): void {
    event.preventDefault();
    if (!values) return;
    const parsed = parseForm(values);
    if (parsed === 'number' || parsed === 'pair') {
      setError(parsed === 'number' ? 'thr.errorNumber' : 'thr.errorPair');
      return;
    }
    setError(null);
    updateThresholds.mutate(parsed, {
      onSuccess: () => {
        push(t('thr.saved'));
        onClose();
      },
      onError: reason => push(apiErrorMessage(reason, t('thr.saveFailed')), 'error'),
    });
  }

  function handleReset(): void {
    resetThresholds.mutate(undefined, {
      onSuccess: () => {
        push(t('thr.resetDone'));
        setIsResetOpen(false);
        onClose();
      },
      onError: reason => {
        push(apiErrorMessage(reason, t('thr.resetFailed')), 'error');
        setIsResetOpen(false);
      },
    });
  }

  return (
    <>
      <Modal open={!isResetOpen} onClose={onClose} title={t('thr.title', { zone: zoneName })} className="max-w-xl">
        {isLoading || !values ? (
          <LoadingSkeleton className="h-64 w-full" />
        ) : (
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THRESHOLD_KEYS.map(key => (
                <Input
                  key={key}
                  label={t(FIELDS[key].labelKey)}
                  type="number"
                  step={FIELDS[key].step}
                  value={values[key]}
                  onChange={event => setValues(current => (current ? { ...current, [key]: event.target.value } : current))}
                />
              ))}
            </div>
            {error && <p className="text-xs text-alertRed">{t(error)}</p>}
            <p className="text-xs text-warmGray">{t('thr.hint')}</p>
            <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
              <Button type="button" variant="secondary" onClick={() => setIsResetOpen(true)}>{t('thr.reset')}</Button>
              <Button type="submit" className="min-w-[8rem]" loading={updateThresholds.isPending}>{t('thr.save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={isResetOpen}
        title={t('thr.resetTitle')}
        description={t('thr.resetDesc', { zone: zoneName })}
        confirmLabel={t('thr.resetConfirm')}
        danger
        loading={resetThresholds.isPending}
        onConfirm={handleReset}
        onCancel={() => setIsResetOpen(false)}
      />
    </>
  );
}
