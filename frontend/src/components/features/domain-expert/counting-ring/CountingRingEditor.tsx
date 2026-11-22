// trình vẽ vòng đếm trên khung live: tối đa 4 vòng, mỗi vòng đếm cả chim vào lẫn ra; xoá hoặc vẽ lại từng vòng
import { useRef, useState } from 'react'
import { Undo2, Trash2, Save, X, Pencil, AlertTriangle, RefreshCw, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useWhepStream } from '@/hooks/shared/useWhepStream'
import { useUpdateCountingRing } from '@/hooks/domain-expert/useCountingRing'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import CountingRingCanvas from './CountingRingCanvas'
import { MAX_POINTS, MAX_RINGS, MIN_POINTS, POINTS_BEFORE_NEXT_RING, placePoint, shownRings } from '@/components/common/countingRing.utils'
import type { CameraNode, CountingRing } from '@/types'
import { t } from '@/i18n'

interface Props {
  camera: CameraNode
  houseId: string | undefined
}

type Confirming = { kind: 'delete'; index: number } | { kind: 'default' } | null

// Chỉ giữ đỉnh và chiều: bản từ API còn kèm người sửa, lúc sửa
const draftOf = (rings: CountingRing[]): CountingRing[] =>
  rings.map(ring => ({ points: ring.points, into_ring_is_exit: ring.into_ring_is_exit }))

export default function CountingRingEditor({ camera, houseId }: Props) {
  const shown = shownRings(camera)
  const [rings, setRings] = useState<CountingRing[]>(() => draftOf(shown.rings))
  const [activeIndex, setActiveIndex] = useState(0)
  // true khi đang thêm đỉnh vào vòng đã chọn lại (tới 12 đỉnh), false khi đang vẽ vòng mới (4 đỉnh rồi sang vòng sau)
  const [extending, setExtending] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, retry } = useWhepStream(videoRef, camera._id)
  const mutation = useUpdateCountingRing(houseId)
  const getErrorMessage = useApiErrorMessage()
  const pushToast = useToastStore(state => state.push)

  // Chiều đếm là của camera (trong nhà hay ngoài trời), vòng mới lấy theo vòng đang có
  const intoRingIsExit = shown.rings[0]?.into_ring_is_exit ?? camera.default_rings?.[0]?.into_ring_is_exit ?? false
  const activeRing = rings[activeIndex] ?? { points: [], into_ring_is_exit: intoRingIsExit }

  function startEditing(draft: CountingRing[], index: number) {
    setRings(draft)
    setActiveIndex(index)
    setExtending(false)
    setIsEditing(true)
    setSaveError(null)
  }
  function handleRedraw(index: number) {
    startEditing(draftOf(shown.rings).map((ring, position) => (position === index ? { ...ring, points: [] } : ring)), index)
  }
  function handleAddPoint(point: [number, number]) {
    const next = placePoint(rings, activeIndex, point, extending, intoRingIsExit)
    if (next.activeIndex !== activeIndex) setExtending(false)
    setRings(next.rings)
    setActiveIndex(next.activeIndex)
  }
  function updateActive(change: (ring: CountingRing) => CountingRing) {
    setRings(current => current.map((ring, index) => (index === activeIndex ? change(ring) : ring)))
  }
  function handleRemovePoint(pointIndex: number) {
    updateActive(ring => ({ ...ring, points: ring.points.filter((_, position) => position !== pointIndex) }))
  }
  function handleSelectRing(index: number) {
    setActiveIndex(index)
    setExtending(true)
  }
  function handleNewRing() {
    setActiveIndex(rings.length)
    setExtending(false)
  }
  function handleRemoveRing() {
    setRings(current => current.filter((_, index) => index !== activeIndex))
    setActiveIndex(0)
    setExtending(true)
  }
  function handleCancel() {
    setRings(draftOf(shown.rings))
    setActiveIndex(0)
    setIsEditing(false)
    setSaveError(null)
  }

  async function save(next: CountingRing[]) {
    setSaveError(null)
    try {
      const result = await mutation.mutateAsync({ cameraId: camera._id, rings: next })
      setRings(next)
      setActiveIndex(0)
      setIsEditing(false)
      setConfirming(null)
      if (next.length === 0) {
        pushToast(
          result.ring_delivered
            ? t('Camera đếm chim dùng lại vòng mặc định.')
            : t('Camera đếm chim dùng lại vòng mặc định khi kết nối lại.'),
          'success',
        )
        return
      }
      pushToast(
        result.ring_delivered
          ? t('Đã lưu vòng đếm và gửi tới camera đếm chim.')
          : t('Đã lưu vòng đếm. Camera đếm chim sẽ nhận khi kết nối lại.'),
        'success',
      )
    } catch (error) {
      setConfirming(null)
      setSaveError(getErrorMessage(error))
    }
  }

  function handleConfirm() {
    if (!confirming) return
    if (confirming.kind === 'default') return void save([])
    // Xoá vòng cuối cùng thì camera về vòng mặc định
    void save(draftOf(shown.rings).filter((_, index) => index !== confirming.index))
  }

  const drawnRings = rings.filter(ring => ring.points.length > 0)
  const canSave = drawnRings.length > 0 && drawnRings.every(ring => ring.points.length >= MIN_POINTS)

  return (
    <div className="space-y-3">
      <div className="relative">
        <CountingRingCanvas
          videoRef={videoRef}
          rings={(isEditing ? rings : shown.rings).map(ring => ring.points)}
          activeIndex={activeIndex}
          isEditing={isEditing}
          onAddPoint={handleAddPoint}
          onRemovePoint={handleRemovePoint}
        />
        {status !== 'playing' && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            <span>
              {status === 'connecting'
                ? t('Đang kết nối luồng…')
                : t('Chưa có luồng, nền đen, vẫn đặt điểm và lưu được')}
            </span>
            {status === 'failed' && (
              <button type="button" onClick={retry} className="inline-flex items-center gap-1 underline">
                <RefreshCw className="w-3 h-3" /> {t('Thử lại')}
              </button>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {isEditing ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {rings.map((ring, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectRing(index)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  index === activeIndex ? 'border-charcoal bg-charcoal text-white' : 'border-warmGray/20 text-charcoal',
                )}
              >
                {t('Vòng {{n}}', { n: index + 1 })}
                <span className="ml-1 text-xs opacity-70">({ring.points.length})</span>
              </button>
            ))}
            {rings.length < MAX_RINGS && activeIndex < rings.length && (
              <Button variant="secondary" size="sm" onClick={handleNewRing} disabled={mutation.isPending}>
                <Plus className="w-4 h-4" /> {t('Vòng mới')}
              </Button>
            )}
            {activeIndex < rings.length && (
              <Button variant="secondary" size="sm" onClick={handleRemoveRing} disabled={mutation.isPending}>
                <Trash2 className="w-4 h-4" /> {t('Bỏ vòng này')}
              </Button>
            )}
          </div>

          <p className="text-sm text-warmGray">
            {t('Chạm lên khung để đặt đỉnh. Đủ {{auto}} đỉnh thì chạm tiếp sẽ sang vòng mới (tối đa {{rings}} vòng). Chọn lại một vòng để thêm đỉnh, tối đa {{max}}. Chạm vào một đỉnh để xoá.', { auto: POINTS_BEFORE_NEXT_RING, rings: MAX_RINGS, max: MAX_POINTS })}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => updateActive(ring => ({ ...ring, points: ring.points.slice(0, -1) }))} disabled={activeRing.points.length === 0 || mutation.isPending}>
                <Undo2 className="w-4 h-4" /> {t('Hoàn tác điểm')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => updateActive(ring => ({ ...ring, points: [] }))} disabled={activeRing.points.length === 0 || mutation.isPending}>
                <Trash2 className="w-4 h-4" /> {t('Xoá hết')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancel} disabled={mutation.isPending}>
                <X className="w-4 h-4" /> {t('Huỷ')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => void save(drawnRings)} disabled={!canSave || mutation.isPending} loading={mutation.isPending}>
                <Save className="w-4 h-4" /> {t('Lưu vòng đếm')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {shown.rings.length === 0 && (
            <p className="text-sm text-warmGray">{t('Chưa có vòng đếm, camera đếm chim dùng vòng mặc định trong cấu hình.')}</p>
          )}
          {shown.rings.map((ring, index) => (
            <div key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warmGray/15 bg-white px-3 py-2 text-sm">
              <span className="font-semibold text-charcoal">
                {t('Vòng {{n}}', { n: index + 1 })}
                <span className="ml-2 font-normal text-warmGray">
                  {shown.isDefault ? t('Vòng mặc định') : t('{{n}} đỉnh', { n: ring.points.length })}
                </span>
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleRedraw(index)} disabled={mutation.isPending}>
                  <Pencil className="w-4 h-4" /> {t('Vẽ lại')}
                </Button>
                {!shown.isDefault && (
                  <Button variant="secondary" size="sm" onClick={() => setConfirming({ kind: 'delete', index })} disabled={mutation.isPending}>
                    <Trash2 className="w-4 h-4" /> {t('Xoá')}
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap justify-end gap-2">
            {!shown.isDefault && (
              <Button variant="secondary" size="sm" onClick={() => setConfirming({ kind: 'default' })} disabled={mutation.isPending}>
                <RotateCcw className="w-4 h-4" /> {t('Dùng lại vòng mặc định')}
              </Button>
            )}
            {shown.rings.length < MAX_RINGS && (
              <Button variant="primary" size="sm" onClick={() => startEditing(draftOf(shown.rings), shown.rings.length)} disabled={mutation.isPending}>
                <Plus className="w-4 h-4" /> {shown.rings.length > 0 ? t('Vẽ thêm vòng') : t('Vẽ vòng đếm')}
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirming !== null}
        title={confirming?.kind === 'default' ? 'Dùng lại vòng mặc định?' : 'Xoá vòng này?'}
        description={
          confirming?.kind === 'delete' && shown.rings.length > 1
            ? 'Camera đếm chim chỉ đếm bằng các vòng còn lại. Số đếm trước và sau khi đổi vòng không so được với nhau.'
            : 'Camera đếm chim sẽ dùng lại vòng mặc định trong cấu hình. Số đếm trước và sau khi đổi vòng không so được với nhau.'
        }
        confirmLabel={confirming?.kind === 'default' ? 'Dùng lại vòng mặc định' : 'Xoá vòng'}
        danger
        loading={mutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
