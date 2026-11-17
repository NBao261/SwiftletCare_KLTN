// VISION-FR-018 — lớp vẽ vòng đếm phủ lên khung video: đa giác + các đỉnh chạm được
import { type MouseEvent, type RefObject } from 'react'

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  points: Array<[number, number]>
  isEditing: boolean
  onAddPoint: (point: [number, number]) => void
  onRemovePoint: (index: number) => void
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export default function CountingRingCanvas({ videoRef, points, isEditing, onAddPoint, onRemovePoint }: Props) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!isEditing) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = clamp01((event.clientX - rect.left) / rect.width)
    const y = clamp01((event.clientY - rect.top) / rect.height)
    onAddPoint([x, y])
  }

  // Toạ độ chuẩn hoá 0–1 → hệ 0–100 của viewBox; preserveAspectRatio none để khớp object-contain
  const polygonPoints = points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
      <div className={`absolute inset-0 ${isEditing ? 'cursor-crosshair' : ''}`} onClick={handleClick}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.length >= 2 && (
            <polygon
              className="fill-limeMist/20 stroke-limeMist"
              points={polygonPoints}
              strokeWidth={2}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {points.map(([x, y], index) => (
          <button
            key={index}
            type="button"
            disabled={!isEditing}
            onClick={event => {
              event.stopPropagation()
              if (isEditing) onRemovePoint(index)
            }}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow disabled:cursor-default bg-limeMist"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-label={`Đỉnh ${index + 1}${isEditing ? ' — chạm để xoá' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
