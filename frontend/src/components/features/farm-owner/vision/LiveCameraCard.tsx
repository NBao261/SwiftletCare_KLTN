import { useState, type ReactNode } from 'react'
import { Play, Maximize2, Minimize2 } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

interface LiveCameraCardProps {
  zoneName: string
  expanded: boolean
  onToggleExpand: () => void
}

// LiveCameraCard – khung video trực tiếp + bounding box nhận diện chim — MOCK, chưa có API thật
export default function LiveCameraCard({ zoneName, expanded, onToggleExpand }: LiveCameraCardProps) {
  const [showBoxes, setShowBoxes] = useState(true)

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-alertRed" />
          <h2 className="text-h2 text-charcoal">Luồng trực tiếp · Camera cửa thu chim ({zoneName})</h2>
        </div>
        <p className="mt-1 text-xs font-medium italic text-warmGray">Dữ liệu minh hoạ, chưa nối API thật</p>
      </div>

      <div className="relative aspect-video max-h-[70vh] overflow-hidden rounded-2xl bg-graphite">
        <div className="flex h-full w-full items-center justify-center">
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-charcoal"
            aria-label="Video minh hoạ, chưa có camera thật"
          >
            <Play width={22} height={22} className="ml-0.5" />
          </button>
        </div>

        {showBoxes && (
          <>
            <DetectionBox className="left-[28%] top-[32%]" label="Swiftlet #1042" confidence={0.94} />
            <DetectionBox className="left-[55%] top-[42%]" label="Swiftlet #1043" confidence={0.91} />
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 text-[11px] font-medium text-white">
          <span className="inline-flex h-10 items-center rounded-full bg-black/60 px-3 backdrop-blur-sm">1080p @ 60fps · Độ trễ ~120ms · RTSP</span>
          <div className="flex h-10 items-center gap-2 rounded-full bg-black/60 px-3 backdrop-blur-sm">
            <IconTooltip label="Hiện khung nhận diện">
              <DarkToggle checked={showBoxes} onChange={setShowBoxes} ariaLabel="Hiện khung nhận diện" />
            </IconTooltip>
            <IconTooltip label={expanded ? 'Thu nhỏ khung camera' : 'Phóng to khung camera'} align="right">
              <button
                type="button"
                onClick={onToggleExpand}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"
                aria-label={expanded ? 'Thu nhỏ khung camera' : 'Phóng to khung camera'}
              >
                {expanded ? <Minimize2 width={18} height={18} /> : <Maximize2 width={18} height={18} />}
              </button>
            </IconTooltip>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Bản Toggle riêng cho nền tối (thanh video) — Toggle dùng chung (@/components/ui)
// lấy track charcoal/warmGray, hợp với card nền trắng nhưng chìm vào nền đen ở
// đây. Không sửa Toggle dùng chung vì nó đang chạy đúng màu ở mọi nơi khác
// trong app — chỉ đổi riêng bản này: BẬT = track trắng + chấm charcoal, TẮT =
// track trắng mờ (white/25) + chấm trắng, cả 2 trạng thái đều nổi trên nền đen.
function DarkToggle({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-white' : 'bg-white/25',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full shadow transition-transform',
          checked ? 'translate-x-[18px] bg-charcoal' : 'translate-x-1 bg-white',
        )}
      />
    </button>
  )
}

// Chỉ hiện nhãn dạng tooltip khi rê chuột (giống nút "Cinema mode" của YouTube) —
// nút bên dưới không còn chữ cố định, đỡ rối thanh thông tin cuối video.
// align="right" cho nút sát mép phải (VD nút thu phóng) — canh tooltip theo mép
// phải thay vì canh giữa, để chữ không tràn ra ngoài khung video bị overflow-hidden cắt mất.
function IconTooltip({ label, children, align = 'center' }: { label: string; children: ReactNode; align?: 'center' | 'right' }) {
  return (
    <div className="group relative flex items-center">
      {children}
      <span
        className={cn(
          'pointer-events-none absolute -top-9 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100',
          align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </div>
  )
}

// Width/height tính theo % của khung video (không phải px cố định) để khung
// nhận diện luôn đúng tỉ lệ dù camera đang thu nhỏ hay phóng to (ENV-FR liên
// quan tới LiveCameraCard.expanded) — trước đây h-16 w-20 cố định nên khi
// khung video giãn to, ô nhận diện bị "lệch" vì không phóng theo.
function DetectionBox({ className, label, confidence }: { className: string; label: string; confidence: number }) {
  return (
    <div className={cn('absolute h-[14%] w-[9%] rounded border-2 border-lime-500', className)}>
      <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-lime-500 px-1.5 py-0.5 text-[10px] font-bold text-charcoal">
        {label} ({confidence.toFixed(2)})
      </span>
    </div>
  )
}
