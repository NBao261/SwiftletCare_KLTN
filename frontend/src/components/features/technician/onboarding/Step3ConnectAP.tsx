// Step3ConnectAP.tsx — Bước 3 (SENSOR_NODE): Kết nối AP + nhập WiFi nhà yến
// Gộp Step3 (AP) và Step4 (WiFi guide) thành một bước duy nhất (FARM-FR-003c).
// Credentials WiFi đã flash sẵn trong firmware; app chỉ hướng dẫn — không gửi qua mạng.
import { useState } from 'react'
import { Button } from '@/components/ui'
import { Copy, Check, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import type { OnboardingState } from './onboardingTypes'

interface Props {
  data: OnboardingState
  onNext: () => void
  onBack: () => void
}

export function Step3ConnectAP({ data, onNext, onBack }: Props) {
  const ssidAP  = `SwiftletCare-Setup-${data.deviceId || 'DEVICE_ID'}`
  const [copied, setCopied]         = useState(false)
  const [apDone, setApDone]         = useState(false)

  function copySSID() {
    void navigator.clipboard.writeText(ssidAP)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 3 — Kết nối AP & cấu hình WiFi</h2>
        <p className="mt-1 text-sm text-warmGray">
          Dùng điện thoại/laptop kết nối vào WiFi AP của thiết bị, sau đó mở trang cấu hình để nhập WiFi nhà yến.
        </p>
      </div>

      {/* SSID display */}
      <div className="flex items-center gap-3 rounded-xl bg-graphite/[0.08] p-4">
        <div className="flex-1">
          <p className="label-caption">Tên WiFi AP cần kết nối</p>
          <p className="mt-1 tabular-nums text-lg font-bold text-charcoal">{ssidAP}</p>
          <p className="mt-0.5 text-sm text-warmGray">Mạng mở, không cần mật khẩu</p>
        </div>
        <button
          type="button"
          onClick={copySSID}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-charcoal shadow-sm hover:bg-graphite/5"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-success" />
              <span>Đã copy</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Các bước hướng dẫn */}
      <ol className="flex flex-col gap-3">
        {[
          `Vào Settings → WiFi, kết nối vào mạng "${ssidAP}"`,
          'Mở trình duyệt, truy cập http://192.168.4.1',
          'Nhập tên & mật khẩu WiFi nhà yến vào trang vừa mở, bấm Lưu cấu hình',
          'Thiết bị tự khởi động lại — MQTT credentials đã được flash sẵn, không cần nhập thêm',
        ].map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white">
              {i + 1}
            </span>
            <p className="text-sm text-charcoal">{s}</p>
          </li>
        ))}
      </ol>

      {/* Confirm AP done trước khi sang WaitOnline */}
      {!apDone ? (
        <Button onClick={() => setApDone(true)} className="w-full justify-center">
          <CheckCircle2 className="h-4 w-4" />
          Tôi đã nhập xong WiFi nhà yến
        </Button>
      ) : (
        <Button onClick={onNext} className="w-full justify-center">
          Tiếp theo — Chờ thiết bị kết nối
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 self-center text-sm text-warmGray hover:text-charcoal"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Thiết bị không phát WiFi? Quay lại</span>
      </button>
    </div>
  )
}
