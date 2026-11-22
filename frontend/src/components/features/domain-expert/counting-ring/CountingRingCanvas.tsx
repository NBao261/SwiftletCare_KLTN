// lớp vẽ vòng đếm phủ lên khung video: mỗi vòng một đa giác, đỉnh của vòng đang sửa chạm được
import { type MouseEvent, type RefObject } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

type Points = Array<[number, number]>

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  rings: Points[]
  activeIndex: number
  isEditing: boolean
  onAddPoint: (point: [number, number]) => void
  onRemovePoint: (index: number) => void
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function centerOf(points: Points): [number, number] {
  const sum = points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

export default function CountingRingCanvas({ videoRef, rings, activeIndex, isEditing, onAddPoint, onRemovePoint }: Props) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!isEditing) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = clamp01((event.clientX - rect.left) / rect.width)
    const y = clamp01((event.clientY - rect.top) / rect.height)
    onAddPoint([x, y])
  }

  const activePoints = rings[activeIndex] ?? []

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
      <div className={`absolute inset-0 ${isEditing ? 'cursor-crosshair' : ''}`} onClick={handleClick}>
        {/* Toạ độ 0–1 → hệ 0–100 của viewBox; preserveAspectRatio none để khớp object-contain */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {rings.map((points, index) => points.length >= 2 && (
            // Màu token accent-600: xanh chanh dễ thấy trên khung hình camera tối; vòng không sửa thì mờ
            <polygon
              key={index}
              points={points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
              className={cn('stroke-accent-600', isEditing && index !== activeIndex ? 'fill-accent-600/5 opacity-50' : 'fill-accent-600/20')}
              strokeWidth={2}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {rings.length > 1 && rings.map((points, index) => {
          if (points.length < 3) return null
          const [x, y] = centerOf(points)
          return (
            <span
              key={`label-${index}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            >
              {index + 1}
            </span>
          )
        })}
        {(isEditing ? [activePoints] : rings).flatMap((points, ringIndex) => points.map(([x, y], index) => (
          <button
            key={`${ringIndex}-${index}`}
            type="button"
            disabled={!isEditing}
            onClick={event => {
              event.stopPropagation()
              if (isEditing) onRemovePoint(index)
            }}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent-600 shadow disabled:cursor-default"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-label={isEditing ? t('Đỉnh {{n}} · chạm để xoá', { n: index + 1 }) : t('Đỉnh {{n}}', { n: index + 1 })}
          />
        )))}
      </div>
    </div>
  )
}
