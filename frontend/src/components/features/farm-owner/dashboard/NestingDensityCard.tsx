import { Lightbulb } from 'lucide-react'
import { Badge, Card } from '@/components/ui'

interface ZoneDensity {
  name: string
  percent: number
}

/**
 * VISION-FR-* — mật độ làm tổ theo Zone phụ thuộc đếm chim qua camera, module
 * chưa triển khai (xem BirdVisionCard). Tên "Zone A (Góc tối yên tĩnh)"... là
 * nhãn minh hoạ cho mục đích trình bày UI, không map vào Zone thật của farm —
 * khi VISION lên thật, danh sách này đổi sang lấy zone thật + % return rate.
 */
const MOCK_ZONES: ZoneDensity[] = [
  { name: 'Zone A (Góc tối yên tĩnh)', percent: 92 },
  { name: 'Zone B (Trung tâm phòng lượn)', percent: 84 },
  { name: 'Zone C (Gần cửa gió cấp)', percent: 68 },
  { name: 'Zone D (Tầng áp mái chống nóng)', percent: 58 },
]

function barTone(percent: number): string {
  if (percent >= 80) return 'bg-success'
  if (percent >= 65) return 'bg-climateOrange'
  return 'bg-alertRed'
}

/** "Mật độ làm tổ theo Zone" + gợi ý AI — card phải dưới Dashboard (screenshot mục 4). */
export default function NestingDensityCard() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Card size="lg" className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h2 text-charcoal">Mật độ làm tổ theo Zone</h2>
            <p className="mt-1 text-sm text-warmGray">So sánh các khu vực trong nhà yến</p>
          </div>
          <Badge tone="neutral">Tuần 38</Badge>
        </div>

        <div className="flex flex-col gap-3.5">
          {MOCK_ZONES.map(zone => (
            <div key={zone.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-charcoal">{zone.name}</span>
                <span className="shrink-0 font-bold text-charcoal">{zone.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/10">
                <div className={`h-full rounded-full ${barTone(zone.percent)}`} style={{ width: `${zone.percent}%` }} />
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-medium italic text-warmGray">
          Cần dữ liệu AI Vision thật để tính mật độ theo Zone
        </p>
      </Card>

      <Card variant="active" size="lg" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-accent-700">
          <Lightbulb width={18} height={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-charcoal">Gợi ý thuật toán AI</p>
          <p className="mt-1 text-sm text-charcoal/80">
            Zone C &amp; D độ ẩm đang dao động nhanh vào 14h chiều. Đề xuất tăng chu kỳ phun sương thêm 4 phút/giờ.
          </p>
        </div>
      </Card>
    </div>
  )
}
