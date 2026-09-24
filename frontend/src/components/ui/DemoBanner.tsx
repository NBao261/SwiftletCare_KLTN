// DemoBanner.tsx — Banner cảnh báo tính năng chưa kết nối backend thật
// Dùng cho OTAPage và OnboardingPage (các tính năng có endpoint chưa sẵn sàng)
interface Props {
  title?: string
  description?: string
}

export default function DemoBanner({
  title = 'Giao diện Demo — Chưa kết nối backend',
  description = 'Chức năng này đang trong giai đoạn phát triển. Các thao tác trên trang này chưa có tác dụng thật với hệ thống.',
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-climateOrange/40 bg-climateOrange/[0.08] px-4 py-3"
    >
      <span className="mt-0.5 shrink-0 text-climateOrange" aria-hidden="true">⚠️</span>
      <div>
        <p className="text-sm font-semibold text-climateOrange">{title}</p>
        <p className="mt-0.5 text-xs text-climateOrange/80">{description}</p>
      </div>
    </div>
  )
}
