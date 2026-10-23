import { Badge, Button, Modal } from '@/components/ui';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { devicesDict } from '@/constants/devices.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAudioTracks, usePlayAudioTrack, useSelectAudioTrack, useStopAudio } from '@/hooks/shared/useAudioTracks';
import { useToastStore } from '@/stores/toastStore';
import type { SensorNode } from '@/types';

const BYTES_PER_MEGABYTE = 1024 * 1024;

// Tên file trên thẻ SD theo số thứ tự (VD 2 → 0002.mp3)
function sdFileName(trackNumber: number): string {
  return `${String(trackNumber).padStart(4, '0')}.mp3`;
}

// Bài loa ru của 1 bộ kit (ENV-FR-013c): chọn bài mặc định, phát thử, dừng với bài đã chép thẻ SD; tải lên / xoá bài là việc của Kỹ thuật viên
export default function LullabyTracksModal({ node, onClose }: { node: SensorNode; onClose: () => void }): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const { data: tracks, isLoading } = useAudioTracks(node._id);
  const selectTrack = useSelectAudioTrack(node._id);
  const playTrack = usePlayAudioTrack(node._id);
  const stopAudio = useStopAudio(node._id);
  const isOnline = node.status === 'ONLINE';

  return (
    <Modal open onClose={onClose} title={t('trk.title', { id: node.device_id })}>
      <div className="flex flex-col gap-4">
        {/* Phát thử chỉ khi bộ kit online; tự dừng sau 5 phút rồi quay về lịch */}
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

        {isLoading && <LoadingSkeleton count={2} className="h-24 w-full" />}
        {!isLoading && tracks?.length === 0 && <p className="text-sm text-warmGray">{t('trk.empty')}</p>}

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
                  {!track.synced_to_sd && <span className="text-xs text-warmGray">{t('trk.waitSd')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
