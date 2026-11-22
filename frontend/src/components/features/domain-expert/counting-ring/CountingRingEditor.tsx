// trình vẽ vòng đếm trên khung live: 1–2 vòng (mỗi lỗ ra vào một vòng), mỗi vòng 3–12 đỉnh và chiều bay riêng
import { useRef, useState } from 'react'
import { Undo2, Trash2, Save, X, Pencil, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useWhepStream } from '@/hooks/shared/useWhepStream'
import { useUpdateCountingRing } from '@/hooks/domain-expert/useCountingRing'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import CountingRingCanvas from './CountingRingCanvas'
import { MAX_RINGS, ringsOfCamera } from '@/components/common/countingRing.utils'
import type { CameraNode, CountingRing } from '@/types'
import { t } from '@/i18n'

const MIN_POINTS = 3
const MAX_POINTS = 12

interface Props {
  camera: CameraNode
  houseId: string | undefined
}

// Chỉ giữ đỉnh và chiều: bản từ API còn kèm người sửa, lúc sửa
const draftOf = (rings: CountingRing[]): CountingRing[] =>
  rings.map(ring => ({ points: ring.points, into_ring_is_exit: ring.into_ring_is_exit }))

export default function CountingRingEditor({ camera, houseId }: Props) {
  const [rings, setRings] = useState<CountingRing[]>(() => draftOf(ringsOfCamera(camera)))
  const [activeIndex, setActiveIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, retry } = useWhepStream(videoRef, camera._id)
  const mutation = useUpdateCountingRing(houseId)
  const getErrorMessage = useApiErrorMessage()
  const pushToast = useToastStore(state => state.push)

  const activeRing = rings[activeIndex] ?? { points: [], into_ring_is_exit: false }

  function updateActive(change: (ring: CountingRing) => CountingRing) {
    setRings(current => current.map((ring, index) => (index === activeIndex ? change(ring) : ring)))
  }
  function handleAddPoint(point: [number, number]) {
    updateActive(ring => (ring.points.length >= MAX_POINTS ? ring : { ...ring, points: [...ring.points, point] }))
  }
  function handleRemovePoint(pointIndex: number) {
    updateActive(ring => ({ ...ring, points: ring.points.filter((_, position) => position !== pointIndex) }))
  }
  function handleStartEditing() {
    if (rings.length === 0) setRings([{ points: [], into_ring_is_exit: false }])
    setActiveIndex(0)
    setIsEditing(true)
    setSaveError(null)
  }
  function handleAddRing() {
    setRings(current => [...current, { points: [], into_ring_is_exit: current[0]?.into_ring_is_exit ?? false }])
    setActiveIndex(rings.length)
  }
  function handleRemoveRing() {
    setRings(current => current.filter((_, index) => index !== activeIndex))
    setActiveIndex(0)
  }
  function handleCancel() {
    setRings(draftOf(ringsOfCamera(camera)))
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
      setIsConfirmingDelete(false)
      if (next.length === 0) {
        pushToast(
          result.ring_delivered
            ? t('Đã xoá vòng đếm. Camera đếm chim dùng lại vòng mặc định.')
            : t('Đã xoá vòng đếm. Camera đếm chim dùng lại vòng mặc định khi kết nối lại.'),
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
      setIsConfirmingDelete(false)
      setSaveError(getErrorMessage(error))
    }
  }

  const canSave = rings.length > 0 && rings.every(ring => ring.points.length >= MIN_POINTS)
  const savedRingCount = ringsOfCamera(camera).length

  return (
    <div className="space-y-3">
      <div className="relative">
        <CountingRingCanvas
          videoRef={videoRef}
          rings={rings.map(ring => ring.points)}
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
          {/* Chọn vòng đang sửa; camera thấy 2 lỗ ra vào thì thêm vòng thứ hai */}
          <div className="flex flex-wrap items-center gap-2">
            {rings.map((ring, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  index === activeIndex ? 'border-charcoal bg-charcoal text-white' : 'border-warmGray/20 text-charcoal',
                )}
              >
                {t('Vòng {{n}}', { n: index + 1 })}
                {ring.points.length < MIN_POINTS && <span className="ml-1 text-xs opacity-70">({ring.points.length})</span>}
              </button>
            ))}
            {rings.length < MAX_RINGS && (
              <Button variant="secondary" size="sm" onClick={handleAddRing} disabled={mutation.isPending}>
                <Plus className="w-4 h-4" /> {t('Thêm vòng thứ hai')}
              </Button>
            )}
            {rings.length > 1 && (
              <Button variant="secondary" size="sm" onClick={handleRemoveRing} disabled={mutation.isPending}>
                <Trash2 className="w-4 h-4" /> {t('Bỏ vòng này')}
              </Button>
            )}
          </div>

          <p className="text-sm text-warmGray">
            {t('Chạm lên khung để thêm đỉnh ({{n}}/{{max}}). Chạm vào một đỉnh để xoá. Cần tối thiểu {{min}} đỉnh.', { n: activeRing.points.length, max: MAX_POINTS, min: MIN_POINTS })}
          </p>

          <div className="flex flex-col gap-2">
            <span className="label-caption">{t('Chiều bay qua vòng')}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateActive(ring => ({ ...ring, into_ring_is_exit: true }))}
                className={cn('rounded-xl border px-3 py-2 text-left text-sm', activeRing.into_ring_is_exit ? 'border-charcoal bg-charcoal/5' : 'border-warmGray/20')}
              >
                <span className="font-semibold text-charcoal">{t('Camera trong nhà')}</span>
                <span className="block text-xs text-warmGray">{t('Chim bay VÀO vòng = RA khỏi tổ')}</span>
              </button>
              <button
                type="button"
                onClick={() => updateActive(ring => ({ ...ring, into_ring_is_exit: false }))}
                className={cn('rounded-xl border px-3 py-2 text-left text-sm', !activeRing.into_ring_is_exit ? 'border-charcoal bg-charcoal/5' : 'border-warmGray/20')}
              >
                <span className="font-semibold text-charcoal">{t('Camera ngoài trời')}</span>
                <span className="block text-xs text-warmGray">{t('Chim bay VÀO vòng = VỀ tổ')}</span>
              </button>
            </div>
          </div>

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
              <Button variant="primary" size="sm" onClick={() => void save(rings)} disabled={!canSave || mutation.isPending} loading={mutation.isPending}>
                <Save className="w-4 h-4" /> {t('Lưu vòng đếm')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-warmGray">
            {savedRingCount > 0
              ? t('Camera đang đếm theo {{n}} vòng đã vẽ.', { n: savedRingCount })
              : t('Chưa có vòng đếm, camera đếm chim dùng vòng mặc định trong cấu hình.')}
          </p>
          <div className="flex gap-2">
            {savedRingCount > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDelete(true)} disabled={mutation.isPending}>
                <Trash2 className="w-4 h-4" /> {t('Xoá vòng đếm')}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleStartEditing}>
              <Pencil className="w-4 h-4" /> {savedRingCount > 0 ? t('Vẽ lại vòng') : t('Vẽ vòng đếm')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={isConfirmingDelete}
        title="Xoá vòng đếm?"
        description="Camera đếm chim sẽ dùng lại vòng mặc định trong cấu hình. Số đếm trước và sau khi đổi vòng không so được với nhau."
        confirmLabel="Xoá vòng đếm"
        danger
        loading={mutation.isPending}
        onConfirm={() => void save([])}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </div>
  )
}
