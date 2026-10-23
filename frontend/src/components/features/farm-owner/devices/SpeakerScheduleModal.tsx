import { useState, type FormEvent } from 'react';

import { Button, Input, Modal, SelectMenu, Toggle } from '@/components/ui';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useUpdateSpeakerSchedule } from '@/hooks/shared/useDevices';
import { useToastStore } from '@/stores/toastStore';
import { MAX_SPEAKER_WINDOWS, hourLabel, validateSpeakerWindows } from '@/validations/common/speakerSchedule.validation';
import type { SensorNode, SpeakerWindow } from '@/types';

// Mặc định firmware (Config.h SPEAKER_WINDOW_*) — dùng khi thiết bị chưa từng được cấu hình lịch
const FIRMWARE_DEFAULT_WINDOWS: SpeakerWindow[] = [{ start: '05:00', end: '07:00' }, { start: '17:00', end: '19:00' }];
const NEW_WINDOW: SpeakerWindow = { start: '17:00', end: '19:00' };
const START_HOURS = Array.from({ length: 24 }, (_, hour) => hourLabel(hour));
const END_HOURS = Array.from({ length: 24 }, (_, hour) => hourLabel(hour + 1));
// Âm lượng DFPlayer: số nguyên 0–30 (backend kiểm cùng khoảng)
const MAX_VOLUME = 30;

// Lịch phát loa ru của 1 bộ kit (ENV-FR-013b): tối đa 2 khung giờ tròn + âm lượng — Farm Owner được sửa
export default function SpeakerScheduleModal({ node, onClose }: { node: SensorNode; onClose: () => void }): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const updateSchedule = useUpdateSpeakerSchedule(node._id);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [isEnabled, setIsEnabled] = useState(node.speaker_schedule.enabled);
  const [windows, setWindows] = useState<SpeakerWindow[]>(
    node.speaker_schedule.windows.length > 0 ? node.speaker_schedule.windows.map(({ start, end }) => ({ start, end })) : FIRMWARE_DEFAULT_WINDOWS,
  );
  const [volume, setVolume] = useState(String(node.audio.volume));
  const [error, setError] = useState<string | null>(null);

  function setWindow(index: number, key: keyof SpeakerWindow, value: string): void {
    setWindows(current => current.map((window, position) => (position === index ? { ...window, [key]: value } : window)));
  }

  function handleSave(event: FormEvent): void {
    event.preventDefault();
    const volumeValue = Number(volume);
    const isVolumeValid = Number.isInteger(volumeValue) && volumeValue >= 0 && volumeValue <= MAX_VOLUME;
    const problem = validateSpeakerWindows(windows) ?? (isVolumeValid ? null : t('sch.errorVolume'));
    setError(problem);
    if (problem) return;
    updateSchedule.mutate({ enabled: isEnabled, windows, volume: volumeValue }, {
      onSuccess: () => {
        push(node.status === 'ONLINE' ? t('sch.saved') : t('sch.savedOffline'));
        onClose();
      },
      onError: reason => push(apiErrorMessage(reason, t('sch.saveFailed')), 'error'),
    });
  }

  return (
    <Modal open onClose={onClose} title={t('sch.title', { id: node.device_id })}>
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-charcoal">{t('sch.enabled')}</span>
          <Toggle checked={isEnabled} onChange={setIsEnabled} aria-label={t('sch.enabled')} />
        </div>

        {windows.map((window, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="label-caption">{t('sch.windowStart', { n: index + 1 })}</span>
              <SelectMenu
                field
                disabled={!isEnabled}
                value={window.start}
                ariaLabel={t('sch.windowStart', { n: index + 1 })}
                options={START_HOURS.map(hour => ({ value: hour, label: hour }))}
                onChange={value => setWindow(index, 'start', value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="label-caption">{t('sch.windowEnd')}</span>
              <SelectMenu
                field
                disabled={!isEnabled}
                value={window.end}
                ariaLabel={t('sch.windowEnd')}
                options={END_HOURS.map(hour => ({ value: hour, label: hour }))}
                onChange={value => setWindow(index, 'end', value)}
              />
            </div>
            {windows.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!isEnabled}
                onClick={() => setWindows(current => current.filter((_, position) => position !== index))}
              >
                {t('sch.remove')}
              </Button>
            )}
          </div>
        ))}
        {windows.length < MAX_SPEAKER_WINDOWS && (
          <Button type="button" variant="secondary" size="sm" disabled={!isEnabled} onClick={() => setWindows(current => [...current, NEW_WINDOW])}>
            {t('sch.add')}
          </Button>
        )}

        <Input label={t('sch.volume')} type="number" min={0} max={MAX_VOLUME} value={volume} onChange={event => setVolume(event.target.value)} />

        {error && <p className="text-xs text-alertRed">{error}</p>}
        <p className="text-xs text-warmGray">{t('sch.hint')}</p>
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('sch.cancel')}</Button>
          <Button type="submit" className="min-w-[8rem]" loading={updateSchedule.isPending}>{t('sch.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
