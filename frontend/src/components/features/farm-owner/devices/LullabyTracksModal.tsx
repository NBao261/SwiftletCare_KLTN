import { useState, type FormEvent } from 'react';

import { Badge, Button, Input, Modal, Toggle } from '@/components/ui';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { canManageLullabyTracks } from '@/components/features/farm-owner/devices/deviceActions';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import {
  useAudioTracks, useDeleteAudioTrack, usePlayAudioTrack, useSelectAudioTrack, useSetAudioTrackSynced, useStopAudio, useUploadAudioTrack,
} from '@/hooks/shared/useAudioTracks';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { MAX_DISPLAY_NAME_LENGTH, validateAudioUpload, type AudioUploadField } from '@/validations/farm-owner/audioTrack.validation';
import type { AudioTrack, SensorNode } from '@/types';

const BYTES_PER_MEGABYTE = 1024 * 1024;

// Tên file trên thẻ SD theo số thứ tự (VD 2 → 0002.mp3)
function sdFileName(trackNumber: number): string {
  return `${String(trackNumber).padStart(4, '0')}.mp3`;
}

// Bài loa ru: Farm Owner quản lý, role khác chỉ xem
export default function LullabyTracksModal({ node, onClose }: { node: SensorNode; onClose: () => void }): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const canManage = canManageLullabyTracks(useAuthStore(state => state.user?.role));
  const { data: tracks, isLoading } = useAudioTracks(node._id);
  const selectTrack = useSelectAudioTrack(node._id);
  const playTrack = usePlayAudioTrack(node._id);
  const stopAudio = useStopAudio(node._id);
  const setSynced = useSetAudioTrackSynced(node._id);
  const deleteTrack = useDeleteAudioTrack(node._id);
  const [deleting, setDeleting] = useState<AudioTrack | null>(null);
  const isOnline = node.status === 'ONLINE';

  return (
    <>
      <Modal open={!deleting} onClose={onClose} title={t('trk.title', { id: node.device_id })}>
        <div className="flex flex-col gap-4">
          {canManage && <UploadForm nodeId={node._id} />}

          {/* Phát thử chỉ khi bộ kit online; tự dừng sau 5 phút rồi quay về lịch */}
          {canManage && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/10 px-3 py-2.5">
              <p className="text-xs text-charcoal">{isOnline ? t('trk.playHint') : t('trk.offline')}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={!isOnline}
                loading={stopAudio.isPending}
                onClick={() => stopAudio.mutate(undefined, {
                  onSuccess: () => push(t('trk.stopped')),
                  onError: reason => push(apiErrorMessage(reason, t('trk.stopFailed')), 'error'),
                })}
              >
                {t('trk.stop')}
              </Button>
            </div>
          )}

          {isLoading && <LoadingSkeleton count={2} className="h-24 w-full" />}
          {!isLoading && tracks?.length === 0 && <p className="text-sm text-warmGray">{t(canManage ? 'trk.empty' : 'trk.emptyReadOnly')}</p>}

          <ul className="flex flex-col divide-y divide-warmGray/10">
            {tracks?.map(track => {
              const isCurrent = node.audio.current_track === track.track_number;
              return (
                <li key={track._id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-charcoal">{track.display_name}</p>
                      <p className="text-xs text-warmGray">
                        {t('trk.file', { file: sdFileName(track.track_number), size: num(track.file_size_bytes / BYTES_PER_MEGABYTE, 1) })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isCurrent && <Badge tone="info">{t('trk.default')}</Badge>}
                      <Badge tone={track.synced_to_sd ? 'positive' : 'warning'}>{track.synced_to_sd ? t('trk.onSd') : t('trk.notOnSd')}</Badge>
                    </div>
                  </div>

                  <audio controls preload="none" src={track.file_url} className="h-9 w-full" aria-label={t('trk.listen', { name: track.display_name })} />

                  {canManage && (
                    <>
                      {/* Bài chỉ chọn và phát được sau khi Farm Owner xác nhận đã chép đúng tên file vào thẻ SD */}
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-charcoal">
                          <Toggle
                            checked={track.synced_to_sd}
                            disabled={setSynced.isPending}
                            aria-label={t('trk.syncedLabel')}
                            onChange={synced => setSynced.mutate({ trackId: track._id, synced }, {
                              onError: reason => push(apiErrorMessage(reason, t('trk.syncFailed')), 'error'),
                            })}
                          />
                          {t('trk.syncedLabel')}
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => setDeleting(track)}>{t('trk.delete')}</Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!track.synced_to_sd || isCurrent}
                          loading={selectTrack.isPending && selectTrack.variables === track._id}
                          onClick={() => selectTrack.mutate(track._id, {
                            onSuccess: () => push(t('trk.selected', { name: track.display_name })),
                            onError: reason => push(apiErrorMessage(reason, t('trk.selectFailed')), 'error'),
                          })}
                        >
                          {t('trk.select')}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!track.synced_to_sd || !isOnline}
                          loading={playTrack.isPending && playTrack.variables === track._id}
                          onClick={() => playTrack.mutate(track._id, {
                            onSuccess: () => push(t('trk.playing', { name: track.display_name })),
                            onError: reason => push(apiErrorMessage(reason, t('trk.playFailed')), 'error'),
                          })}
                        >
                          {t('trk.play')}
                        </Button>
                        {!track.synced_to_sd && <span className="text-xs text-warmGray">{t('trk.waitSd', { file: sdFileName(track.track_number) })}</span>}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title={t('trk.deleteTitle', { name: deleting?.display_name ?? '' })}
        description={t('trk.deleteDesc')}
        confirmLabel={t('trk.delete')}
        danger
        loading={deleteTrack.isPending}
        onConfirm={() => deleting && deleteTrack.mutate(deleting._id, {
          onSuccess: () => { push(t('trk.deleted')); setDeleting(null); },
          onError: reason => { push(apiErrorMessage(reason, t('trk.deleteFailed')), 'error'); setDeleting(null); },
        })}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

// Tải bản gốc lên; số thứ tự phải trùng tên file sẽ chép vào thẻ SD (0002.mp3 ↔ 2)
function UploadForm({ nodeId }: { nodeId: string }): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const upload = useUploadAudioTrack(nodeId);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [file, setFile] = useState<File | null>(null);
  const [trackNumber, setTrackNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Partial<Record<AudioUploadField, string>>>({});
  // Đổi key để xoá file đã chọn trong <input type=file>
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const found = validateAudioUpload({ file, trackNumber, displayName });
    setErrors(found);
    if (Object.keys(found).length > 0 || !file) return;
    upload.mutate({ file, track_number: Number(trackNumber), display_name: displayName.trim() }, {
      onSuccess: () => {
        push(t('trk.uploaded', { file: sdFileName(Number(trackNumber)) }));
        setFile(null);
        setTrackNumber('');
        setDisplayName('');
        setFormKey(key => key + 1);
      },
      onError: reason => push(apiErrorMessage(reason, t('trk.uploadFailed')), 'error'),
    });
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-warmGray/15 p-3">
      <p className="label-caption">{t('trk.uploadTitle')}</p>
      <div className="flex flex-col gap-1.5">
        <input type="file" accept=".mp3,audio/mpeg" aria-label={t('trk.fileLabel')} className="text-sm"
          onChange={event => setFile(event.target.files?.[0] ?? null)} />
        {errors.file && <span className="text-xs text-alertRed">{errors.file}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('trk.numberLabel')} type="number" min={1} max={255} placeholder={t('trk.numberPlaceholder')}
          value={trackNumber} error={errors.trackNumber} onChange={event => setTrackNumber(event.target.value)} />
        <Input label={t('trk.nameLabel')} placeholder={t('trk.namePlaceholder')} maxLength={MAX_DISPLAY_NAME_LENGTH}
          value={displayName} error={errors.displayName} onChange={event => setDisplayName(event.target.value)} />
      </div>
      <Button type="submit" size="sm" loading={upload.isPending}>{t('trk.upload')}</Button>
    </form>
  );
}
