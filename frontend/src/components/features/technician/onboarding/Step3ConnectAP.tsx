// Step3ConnectAP.tsx — Bước 3: Kết nối AP WiFi của ESP32
import { useState } from 'react'
import { Button } from '@/components/ui'
import type { OnboardingState } from './onboardingTypes'

interface Props {
  data: OnboardingState
  onNext: () => void
  onBack: () => void
}

export function Step3ConnectAP({ data, onNext, onBack }: Props) {
  const ssidAP = `SwiftletCare-Setup-${data.deviceId || 'DEVICE_ID'}`
  const [copied, setCopied] = useState(false)

  function copySSID() {
    void navigator.clipboard.writeText(ssidAP)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 3 — Kết nối vào WiFi của ESP32</h2>
        <p className="mt-1 text-sm text-warmGray">
          ESP32 đang phát một mạng WiFi tạm. Dùng điện thoại/laptop kết nối vào mạng đó.
        </p>
      </div>

      {/* SSID display */}
      <div className="flex items-center gap-3 rounded-xl bg-graphite/[0.08] p-4">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">Tên WiFi cần kết nối</p>
          <p className="mt-1 font-mono text-lg font-bold text-charcoal">{ssidAP}</p>
          <p className="mt-0.5 text-sm text-warmGray">Mật khẩu: <span className="font-mono font-semibold">swiftlet2025</span></p>
        </div>
        <button
          onClick={copySSID}
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-charcoal shadow-sm hover:bg-graphite/5"
        >
          {copied ? '✓ Đã copy' : 'Copy'}
        </button>
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-3">
        {[
          'Vào Settings → WiFi trên điện thoại của bạn',
          `Kết nối vào mạng "${ssidAP}"`,
          'Khi kết nối xong, quay lại ứng dụng này và bấm "Tôi đã kết nối"',
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white">
              {i + 1}
            </span>
            <p className="text-sm text-charcoal">{step}</p>
          </li>
        ))}
      </ol>

      <Button onClick={onNext} className="w-full justify-center">
        ✅ Tôi đã kết nối vào AP
      </Button>
      <button
        onClick={onBack}
        className="text-center text-sm text-warmGray hover:text-charcoal"
      >
        ESP32 không phát WiFi? Thử lại từ đầu
      </button>
    </div>
  )
}
