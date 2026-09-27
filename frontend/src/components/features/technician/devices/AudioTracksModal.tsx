import { useState, FormEvent } from 'react'
import { usePermission } from '@/hooks/common/usePermission'
import {
  useAudioTracks, useUploadAudioTrack, useSetAudioTrackSynced, useDeleteAudioTrack,
  useSelectAudioTrack, usePlayAudioTrack, useStopAudio,
} from '@/hooks/shared/useAudioTracks'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { Badge, Button, Input, Modal, Toggle } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { validateAudioUpload, type AudioUploadField } from '@/validations/technician/audioTrack.validation'
import type { AudioTrack, SensorNode } from '@/types'

const sdName = (n: number) => `${String(n).padStart(4, '0')}.mp3`
const sizeLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * ENV-FR-013c — danh mục file loa ru của 1 thiết bị. Theo RACI SRS ⁹: Technician/Admin
 * upload + tự đánh dấu đã chép vào thẻ SD (web không ghi được xuống thẻ); Farm Owner
 * chọn bài mặc định cho lịch và phát thử — chỉ với bài đã có trên thẻ.
 */
export default function AudioTracksModal({ node, onClose }: { node: SensorNode; onClose: () => void }) {
  const canManage = usePermission('TECHNICIAN', 'ADMIN')
  const canOperate = usePermission('FARM_OWNER')
  const push = useToastStore(s => s.push)
  const { data: tracks, isLoading } = useAudioTracks(node._id)
  const setSynced = useSetAudioTrackSynced(node._id)
  const deleteTrack = useDeleteAudioTrack(node._id)
  const selectTrack = useSelectAudioTrack(node._id)
  const playTrack = usePlayAudioTrack(node._id)
  const stopAudio = useStopAudio(node._id)
  const [deleting, setDeleting] = useState<AudioTrack | null>(null)
  const online = node.status === 'ONLINE'

  const onError = (fallback: string) => (err: unknown) => push(getApiErrorMessage(err, fallback), 'error')

  return (
    <>
      <Modal open={!deleting} onClose={onClose} title={`File loa ru — ${node.device_id}`}>
        <div className="flex flex-col gap-4">
          {canManage && <UploadForm nodeId={node._id} />}

          {canOperate && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/10 px-3 py-2.5">
              <p className="text-xs text-charcoal">
                {online ? 'Phát thử tự dừng sau 5 phút, rồi quay về lịch.' : 'Thiết bị đang offline — không phát thử được.'}
              </p>
              <Button size="sm" variant="secondary" disabled={!online} loading={stopAudio.isPending}
                onClick={() => stopAudio.mutate(undefined, { onSuccess: () => push('Đã gửi lệnh dừng phát'), onError: onError('Dừng phát thất bại') })}>
                Dừng phát thử
              </Button>
            </div>
          )}

          {isLoading && <LoadingSkeleton count={2} className="h-24 w-full" />}
          {!isLoading && tracks?.length === 0 && (
            <p className="text-sm text-warmGray">
              Chưa có bài nào. {canManage ? 'Upload file .mp3 rồi chép đúng tên 000N.mp3 vào thẻ SD của thiết bị.' : 'Kỹ thuật viên sẽ upload và chép file vào thẻ SD.'}
            </p>
          )}

          <ul className="flex flex-col divide-y divide-warmGray/10">
            {tracks?.map(track => {
              const isCurrent = node.audio.current_track === track.track_number
              return (
                <li key={track._id} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-charcoal">{track.display_name}</p>
                      <p className="text-xs text-warmGray">{sdName(track.track_number)} · {sizeLabel(track.file_size_bytes)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isCurrent && <Badge tone="info">Bài mặc định</Badge>}
                      <Badge tone={track.synced_to_sd ? 'positive' : 'warning'}>
                        {track.synced_to_sd ? 'Đã có trên thẻ SD' : 'Chưa chép vào thẻ SD'}
                      </Badge>
                    </div>
                  </div>

                  <audio controls preload="none" src={track.file_url} className="h-9 w-full" aria-label={`Nghe bản gốc ${track.display_name}`} />

                  {canManage && (
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-charcoal">
                        <Toggle checked={track.synced_to_sd} disabled={setSynced.isPending} aria-label="Đã chép vào thẻ SD"
                          onChange={synced => setSynced.mutate({ trackId: track._id, synced }, { onError: onError('Cập nhật thất bại') })} />
                        Đã chép vào thẻ SD
                      </label>
                      <Button size="sm" variant="secondary" onClick={() => setDeleting(track)}>Xoá</Button>
                    </div>
                  )}

                  {canOperate && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" disabled={!track.synced_to_sd || isCurrent} loading={selectTrack.isPending && selectTrack.variables === track._id}
                        onClick={() => selectTrack.mutate(track._id, { onSuccess: () => push(`Đã đặt "${track.display_name}" làm bài phát theo lịch`), onError: onError('Chọn bài thất bại') })}>
                        Đặt làm bài mặc định
                      </Button>
                      <Button size="sm" disabled={!track.synced_to_sd || !online} loading={playTrack.isPending && playTrack.variables === track._id}
                        onClick={() => playTrack.mutate(track._id, { onSuccess: () => push(`Đang phát thử "${track.display_name}" trên loa`), onError: onError('Phát thử thất bại') })}>
                        Phát thử trên loa
                      </Button>
                      {!track.synced_to_sd && <span className="text-xs text-warmGray">Chờ kỹ thuật viên chép file vào thẻ SD</span>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        title={`Xoá "${deleting?.display_name}" khỏi danh mục?`}
        description="Chỉ xoá khỏi web — file trên thẻ SD của thiết bị vẫn còn, cần tự xoá tay nếu muốn."
        confirmLabel="Xoá"
        danger
        loading={deleteTrack.isPending}
        onConfirm={() => deleting && deleteTrack.mutate(deleting._id, {
          onSuccess: () => { push('Đã xoá khỏi danh mục'); setDeleting(null) },
          onError: err => { onError('Xoá thất bại')(err); setDeleting(null) },
        })}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

/** Technician/Admin — upload bản gốc; số thứ tự phải trùng tên file sẽ chép vào thẻ SD */
function UploadForm({ nodeId }: { nodeId: string }) {
  const upload = useUploadAudioTrack(nodeId)
  const push = useToastStore(s => s.push)
  const [file, setFile] = useState<File | null>(null)
  const [trackNumber, setTrackNumber] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errors, setErrors] = useState<Partial<Record<AudioUploadField, string>>>({})
  const [formKey, setFormKey] = useState(0) // đổi key để xoá file đã chọn trong <input type=file>

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateAudioUpload({ file, trackNumber, displayName })
    setErrors(found)
    if (Object.keys(found).length > 0 || !file) return
    upload.mutate({ file, track_number: Number(trackNumber), display_name: displayName.trim() }, {
      onSuccess: () => {
        push(`Đã upload — nhớ chép file vào thẻ SD với tên ${sdName(Number(trackNumber))} rồi bật "Đã chép vào thẻ SD"`)
        setFile(null); setTrackNumber(''); setDisplayName(''); setFormKey(k => k + 1)
      },
      onError: err => push(getApiErrorMessage(err, 'Upload thất bại'), 'error'),
    })
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-warmGray/15 p-3">
      <p className="label-caption">Upload bài mới</p>
      <div className="flex flex-col gap-1.5">
        <input type="file" accept=".mp3,audio/mpeg" aria-label="File .mp3" className="text-sm"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {errors.file && <span className="text-xs text-alertRed">{errors.file}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Số thứ tự trên thẻ SD" type="number" min={1} max={255} placeholder="VD: 2 = 0002.mp3"
          value={trackNumber} error={errors.trackNumber} onChange={e => setTrackNumber(e.target.value)} />
        <Input label="Tên bài" placeholder="VD: Tiếng chim gọi bầy"
          value={displayName} error={errors.displayName} onChange={e => setDisplayName(e.target.value)} />
      </div>
      <Button type="submit" size="sm" loading={upload.isPending}>Upload</Button>
    </form>
  )
}
