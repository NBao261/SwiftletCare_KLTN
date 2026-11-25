import { useEffect, useState } from 'react';
import { LockSimpleIcon } from '@phosphor-icons/react';

import { Badge, Button, Input, LoadingSkeleton, Modal, ModalHeader, SelectMenu, type BadgeTone } from '@/components/ui';
import {
  CAMERA_PATH_PRESETS, DEFAULT_RTSP_PORT, parseRtspInput, validateCameraSource, type CameraSourceForm,
} from '@/components/features/farm-owner/devices/cameraSource';
import { devicesDict, type DevicesKey } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCameraSource, useUpdateCameraSource } from '@/hooks/farm-owner/useCameraSource';
import { useToastStore } from '@/stores/toastStore';
import type { CameraStatus } from '@/types';

export const CAMERA_STATUS_TONE: Record<CameraStatus, BadgeTone> = {
  OK: 'positive', NO_SOURCE: 'neutral', AUTH_FAILED: 'critical', UNREACHABLE: 'warning', NO_FRAMES: 'warning',
};

const EMPTY_FORM: CameraSourceForm = { host: '', port: String(DEFAULT_RTSP_PORT), username: 'admin', password: '', path: CAMERA_PATH_PRESETS[0].path };
const OTHER_PRESET = '';

interface Props {
  camera: { id: string; deviceId: string } | undefined;
  onClose: () => void;
}

// Farm Owner nhập địa chỉ camera IP của nút AI; mật khẩu mã hoá ở backend, không bao giờ hiện lại
export default function CameraSourceModal({ camera, onClose }: Props): JSX.Element {
  const { t, dateTime } = useTranslation(devicesDict);
  const source = useCameraSource(camera?.id);
  const update = useUpdateCameraSource(camera?.id ?? '');
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(s => s.push);
  const [form, setForm] = useState<CameraSourceForm>(EMPTY_FORM);
  const [paste, setPaste] = useState('');
  const [pasteInvalid, setPasteInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const saved = source.data?.source;
  // Mở cửa sổ: điền lại các ô đã lưu (trừ mật khẩu)
  useEffect(() => {
    if (!camera) return;
    setPaste(''); setPasteInvalid(false); setSubmitted(false);
    setForm(saved ? { host: saved.host, port: String(saved.port), username: saved.username, password: '', path: saved.path } : EMPTY_FORM);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở hoặc khi bản lưu đổi, không theo mỗi lần đọc lại tình trạng
  }, [camera?.id, saved?.version]);

  const errors = validateCameraSource(form);
  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (field: keyof CameraSourceForm) => (submitted && errors[field] ? t(errors[field] as DevicesKey) : undefined);
  const set = (patch: Partial<CameraSourceForm>) => setForm(previous => ({ ...previous, ...patch }));

  function applyPaste(text: string) {
    setPaste(text);
    if (!text.trim()) { setPasteInvalid(false); return; }
    const parsed = parseRtspInput(text);
    setPasteInvalid(!parsed);
    if (parsed) set(parsed);
  }

  function save() {
    setSubmitted(true);
    if (hasErrors || !camera) return;
    update.mutate({
      host: form.host.trim(), port: Number(form.port), username: form.username.trim(), path: form.path.trim(),
      // Để trống khi đã có mật khẩu: giữ mật khẩu cũ
      ...(form.password || !saved?.has_password ? { password: form.password } : {}),
    }, {
      onSuccess: () => { push(t('source.saved')); onClose(); },
      onError: err => push(apiErrorMessage(err, t('source.saveFailed')), 'error'),
    });
  }

  const status = source.data?.camera_status;
  const presetValue = CAMERA_PATH_PRESETS.some(preset => preset.path === form.path) ? form.path : OTHER_PRESET;
  const presetOptions = [
    ...CAMERA_PATH_PRESETS.map(preset => ({ value: preset.path, label: preset.brand })),
    { value: OTHER_PRESET, label: t('source.presetOther') },
  ];

  const title = t('source.title', { id: camera?.deviceId ?? '' });
  return (
    <Modal open={!!camera} onClose={update.isPending ? () => undefined : onClose} size="lg" ariaLabel={title}>
      <div className="flex flex-col gap-5">
        <ModalHeader title={title} description={t('source.description')} />

        {source.isLoading && <LoadingSkeleton count={3} className="h-12 w-full" />}
        {source.isError && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-warmGray">
            {t('source.loadFailed')}
            <Button variant="secondary" size="sm" onClick={() => source.refetch()}>{t('source.retry')}</Button>
          </div>
        )}

        {source.data && (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-charcoal">
              <span className="text-warmGray">{t('source.status')}:</span>
              <Badge tone={status ? CAMERA_STATUS_TONE[status] : 'neutral'}>{t(status ? `cameraStatus.${status}` : 'cameraStatus.unknown')}</Badge>
              {source.data.camera_status_at && <span className="text-xs text-warmGray">{dateTime(source.data.camera_status_at)}</span>}
            </p>

            <Input
              label={t('source.paste')}
              placeholder={t('source.pastePlaceholder')}
              value={paste}
              onChange={event => applyPaste(event.target.value)}
              error={pasteInvalid ? t('source.pasteInvalid') : undefined}
              autoComplete="off"
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Input label={t('source.host')} placeholder={t('source.hostPlaceholder')} value={form.host}
                onChange={event => set({ host: event.target.value })} error={fieldError('host')} autoComplete="off" />
              <Input label={t('source.port')} inputMode="numeric" value={form.port}
                onChange={event => set({ port: event.target.value })} error={fieldError('port')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={t('source.username')} value={form.username}
                onChange={event => set({ username: event.target.value })} error={fieldError('username')} autoComplete="off" />
              <Input label={t('source.password')} type="password" value={form.password} autoComplete="new-password"
                placeholder={saved?.has_password ? t('source.passwordKeep') : undefined}
                onChange={event => set({ password: event.target.value })} error={fieldError('password')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
                {t('source.preset')}
                <SelectMenu field highlightFiltered={false} ariaLabel={t('source.preset')} value={presetValue} options={presetOptions}
                  onChange={path => { if (path) set({ path }); }} />
              </label>
              <Input label={t('source.path')} value={form.path} onChange={event => set({ path: event.target.value })}
                error={fieldError('path')} autoComplete="off" />
            </div>
            <p className="flex items-center gap-2 text-xs text-warmGray">
              <LockSimpleIcon size={14} aria-hidden />{t('source.security')}
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>{t('source.cancel')}</Button>
          <Button onClick={save} disabled={!source.data || (submitted && hasErrors)} loading={update.isPending}>{t('source.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
