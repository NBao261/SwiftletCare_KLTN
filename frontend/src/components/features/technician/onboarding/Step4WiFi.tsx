import { Button } from '@/components/ui'
import type { OnboardingState } from './onboardingTypes'

interface Props {
  data: OnboardingState
  onNext: () => void
  onBack: () => void
}

export function Step4WiFi({ data, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 4 — Cấu hình WiFi nhà yến</h2>
        <p className="mt-1 text-sm text-warmGray">
          Làm theo hướng dẫn dưới đây để kết nối thiết bị với mạng WiFi của nhà yến.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-skyBlue/40 bg-skyBlue/[0.08] px-4 py-3">
        <span className="mt-0.5 shrink-0 text-skyBlue" aria-hidden="true">ℹ️</span>
        <div>
          <p className="text-sm font-semibold text-skyBlue">Cấu hình Local AP Mode</p>
          <p className="mt-0.5 text-xs text-skyBlue/80">
            Quá trình này không yêu cầu kết nối Internet. Điện thoại/máy tính của bạn sẽ kết nối trực tiếp với trạm phát WiFi (AP) của ESP32.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 pl-2">
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-graphite text-xs font-bold text-white">1</div>
          <p className="text-sm text-charcoal">
            Dùng điện thoại hoặc máy tính kết nối vào WiFi có tên: <br />
            <strong className="text-skyBlue">SwiftletCare-Setup-{data.deviceId || '<DeviceId>'}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-graphite text-xs font-bold text-white">2</div>
          <p className="text-sm text-charcoal">
            Mở trình duyệt web và truy cập địa chỉ: <br />
            <strong className="text-skyBlue">http://192.168.4.1</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-graphite text-xs font-bold text-white">3</div>
          <p className="text-sm text-charcoal">
            Nhập tên và mật khẩu WiFi của nhà yến vào trang web vừa mở, sau đó bấm <strong>Lưu cấu hình</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-limeMist/25 bg-limeMist/10 px-4 py-3 mt-2">
        <p className="text-sm text-charcoal">
          ℹ️ MQTT credentials sẽ được tự động cấu hình. Sau khi ESP32 lưu WiFi xong, thiết bị sẽ tự khởi động lại.
        </p>
      </div>

      <div className="flex gap-3 mt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1">← Quay lại</Button>
        <Button onClick={onNext} className="flex-1">
          Tôi đã nhập xong
        </Button>
      </div>
    </div>
  )
}
