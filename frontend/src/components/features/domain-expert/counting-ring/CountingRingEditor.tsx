// trình vẽ vòng đếm trên khung live: đặt 3–12 đỉnh, chọn chiều bay, lưu
import { useRef, useState } from 'react'
import { Undo2, Trash2, Save, X, Pencil, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { useWhepStream } from '@/hooks/shared/useWhepStream'
import { useUpdateCountingRing } from '@/hooks/domain-expert/useCountingRing'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import CountingRingCanvas from './CountingRingCanvas'
import type { CameraNode } from '@/types'
import { t } from '@/i18n'

const MIN_POINTS = 3
const MAX_POINTS = 12

interface Props {
  camera: CameraNode
  houseId: string | undefined
}

export default function CountingRingEditor({ camera, houseId }: Props) {
  const ring = camera.counting_ring
  const [points, setPoints] = useState<Array<[number, number]>>(ring?.points ?? [])
  const [intoRingIsExit, setIntoRingIsExit] = useState<boolean>(ring?.into_ring_is_exit ?? false)
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, retry } = useWhepStream(videoRef, camera._id)
  const mutation = useUpdateCountingRing(houseId)
  const getErrorMessage = useApiErrorMessage()
  const pushToast = useToastStore(state => state.push)

  function handleAddPoint(point: [number, number]) {
    setPoints(current => (current.length >= MAX_POINTS ? current : [...current, point]))
  }
  function handleRemovePoint(index: number) {
    setPoints(current => current.filter((_, position) => position !== index))
  }
  function handleStartEditing() {
    setIsEditing(true)
    setSaveError(null)
  }
  function handleCancel() {
    setPoints(ring?.points ?? [])
    setIntoRingIsExit(ring?.into_ring_is_exit ?? false)
    setIsEditing(false)
    setSaveError(null)
  }
  async function handleSave() {
    if (points.length < MIN_POINTS) return
    setSaveError(null)
    try {
      const result = await mutation.mutateAsync({
        cameraId: camera._id,
        ring: { points, into_ring_is_exit: intoRingIsExit },
      })
      setIsEditing(false)
      pushToast(
        result.ring_delivered
          ? t('Đã lưu vòng đếm và gửi tới camera đếm chim.')
          : t('Đã lưu vòng đếm. Camera đếm chim sẽ nhận khi kết nối lại.'),
        'success',
      )
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  const hasRing = points.length >= MIN_POINTS

  return (
    <div className="space-y-3">
      <div className="relative">
        <CountingRingCanvas
          videoRef={videoRef}
          points={points}
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

      {isEditing ? (
        <>
          <p className="text-sm text-warmGray">
            {t('Chạm lên khung để thêm đỉnh ({{n}}/{{max}}). Chạm vào một đỉnh để xoá. Cần tối thiểu {{min}} đỉnh.', { n: points.length, max: MAX_POINTS, min: MIN_POINTS })}
          </p>

          <div className="flex flex-col gap-2">
            <span className="label-caption">{t('Chiều bay qua vòng')}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIntoRingIsExit(true)}
                className={cn('rounded-xl border px-3 py-2 text-left text-sm', intoRingIsExit ? 'border-charcoal bg-charcoal/5' : 'border-warmGray/20')}
              >
                <span className="font-semibold text-charcoal">{t('Camera trong nhà')}</span>
                <span className="block text-xs text-warmGray">{t('Chim bay VÀO vòng = RA khỏi tổ')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIntoRingIsExit(false)}
                className={cn('rounded-xl border px-3 py-2 text-left text-sm', !intoRingIsExit ? 'border-charcoal bg-charcoal/5' : 'border-warmGray/20')}
              >
                <span className="font-semibold text-charcoal">{t('Camera ngoài trời')}</span>
                <span className="block text-xs text-warmGray">{t('Chim bay VÀO vòng = VỀ tổ')}</span>
              </button>
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPoints(current => current.slice(0, -1))} disabled={points.length === 0 || mutation.isPending}>
                <Undo2 className="w-4 h-4" /> {t('Hoàn tác điểm')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPoints([])} disabled={points.length === 0 || mutation.isPending}>
                <Trash2 className="w-4 h-4" /> {t('Xoá hết')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancel} disabled={mutation.isPending}>
                <X className="w-4 h-4" /> {t('Huỷ')}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={!hasRing || mutation.isPending} loading={mutation.isPending}>
                <Save className="w-4 h-4" /> {t('Lưu vòng đếm')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-warmGray">
            {hasRing
              ? t('Vòng hiện tại có {{n}} đỉnh.', { n: points.length })
              : t('Chưa có vòng đếm, camera đếm chim dùng vòng mặc định trong cấu hình.')}
          </p>
          <Button variant="primary" size="sm" onClick={handleStartEditing}>
            <Pencil className="w-4 h-4" /> {hasRing ? t('Vẽ lại vòng') : t('Vẽ vòng đếm')}
          </Button>
        </div>
      )}
    </div>
  )
}
