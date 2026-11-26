// Bước 3: kết nối AP của thiết bị; app chỉ hướng dẫn, không gửi WiFi qua mạng
import { useState } from 'react'
import { Button } from '@/components/ui'
import { Copy, Check, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react'
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
        <h2 className="text-lg font-bold text-charcoal">Bước 3: Kết nối Wi-Fi của thiết bị</h2>
        <p className="mt-1 text-sm text-warmGray">
          Dùng điện thoại hoặc máy tính kết nối vào Wi-Fi do thiết bị phát ra, rồi mở trang cài đặt để nhập Wi-Fi của nhà yến.
        </p>
      </div>

      {/* SSID display */}
      <div className="flex items-center gap-3 rounded-xl bg-graphite/[0.08] p-4">
        <div className="flex-1">
          <p className="label-caption">Tên Wi-Fi thiết bị phát ra</p>
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
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Chép</span>
            </>
          )}
        </button>
      </div>

      {/* Thiết bị chỉ có anten 2,4 GHz: nhập Wi-Fi 5 GHz thì không bao giờ kết nối được */}
      <div className="flex items-start gap-3 rounded-xl bg-climateOrange/10 p-4" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-climateOrange" aria-hidden />
        <div className="text-sm text-charcoal">
          <p className="font-semibold">Chỉ nhập Wi-Fi 2,4 GHz</p>
          <p className="mt-0.5 text-warmGray">
            Thiết bị không kết nối được Wi-Fi 5 GHz. Nếu bộ phát Wi-Fi gộp hai băng tần dưới một tên mà thiết bị không nối được,
            nhờ người lắp mạng tách riêng tên mạng 2,4 GHz.
          </p>
        </div>
      </div>

      {/* Các bước hướng dẫn */}
      <ol className="flex flex-col gap-3">
        {[
          `Vào Cài đặt → Wi-Fi, kết nối vào mạng "${ssidAP}"`,
          'Mở trình duyệt, vào địa chỉ http://192.168.4.1',
          'Nhập tên và mật khẩu Wi-Fi 2,4 GHz của nhà yến vào trang vừa mở, bấm Lưu cấu hình',
          'Thiết bị tự khởi động lại. Thông tin kết nối máy chủ đã nạp sẵn, không cần nhập.',
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
          Tôi đã nhập xong Wi-Fi 2,4 GHz của nhà yến
        </Button>
      ) : (
        <>
          {/* Nhắc lại đúng lúc thiết bị bắt đầu nối Wi-Fi */}
          <p className="text-center text-sm text-warmGray">
            Thiết bị sẽ tự khởi động lại rồi nối Wi-Fi của nhà yến. Chỉ nối được mạng 2,4 GHz.
          </p>
          <Button onClick={onNext} className="w-full justify-center">
            Tiếp theo: chờ thiết bị kết nối
            <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 self-center text-sm text-warmGray hover:text-charcoal"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Thiết bị không phát Wi-Fi? Quay lại</span>
      </button>
    </div>
  )
}
