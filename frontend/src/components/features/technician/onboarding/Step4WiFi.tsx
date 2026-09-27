// Step4WiFi.tsx — Bước 4: Cấu hình WiFi nhà yến cho ESP32 (B9)
// TODO [BE-GAP]: Bước này cần gọi trực tiếp HTTP endpoint của ESP32 ở AP-mode
// (fetch('http://192.168.4.1/configure', { body: JSON.stringify({ssid, pass}) }))
// Hiện tại KHÔNG có backend endpoint nào nhận cấu hình WiFi.
// DEMO MODE: lưu ssid/wifiPass vào OnboardingState và chuyển bước tiếp — không gửi gì đến ESP32.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui'
import type { OnboardingState } from './onboardingTypes'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}

export function Step4WiFi({ data, patch, onNext, onBack }: Props) {
  const [showPass, setShowPass] = useState(false)
  const [sendError, setSendError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      // TODO [BE-GAP]: Thực tế cần gọi fetch('http://192.168.4.1/configure', ...)
      // để gửi ssid/wifiPass trực tiếp tới ESP32 qua AP local network.
      // Hiện tại: giả lập thành công (chỉ lưu state, không gọi API nào)
      await new Promise(r => setTimeout(r, 500))
    },
    onSuccess: () => onNext(),
    onError: () => setSendError('Chưa có API cấu hình WiFi — chức năng này đang được phát triển.'),
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 4 — Cấu hình WiFi nhà yến</h2>
        <p className="mt-1 text-sm text-warmGray">
          Nhập thông tin WiFi của nhà yến để ESP32 tự kết nối sau khi cài đặt.
        </p>
      </div>

      {/* TODO [BE-GAP]: Banner cảnh báo Demo — xóa khi có API gửi cấu hình WiFi đến ESP32 */}
      <div className="flex items-start gap-3 rounded-xl border border-climateOrange/40 bg-climateOrange/[0.08] px-4 py-3">
        <span className="mt-0.5 shrink-0 text-climateOrange" aria-hidden="true">🔧</span>
        <div>
          <p className="text-sm font-semibold text-climateOrange">Chế độ Demo — Chưa gửi cấu hình thật</p>
          <p className="mt-0.5 text-xs text-climateOrange/80">
            Bước này hiện chưa gửi SSID/mật khẩu đến ESP32 (cần kết nối trực tiếp qua AP local). Đây là bản demo — thông tin WiFi chỉ được lưu tạm trong wizard.
            Bước tiếp theo sẽ <strong>chờ socket event từ thiết bị</strong>.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Tên WiFi (SSID)</label>
        <input
          value={data.ssid}
          onChange={e => patch({ ssid: e.target.value })}
          placeholder="VD: NhaYen_WiFi_2.4GHz"
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Mật khẩu WiFi</label>
        <div className="flex gap-2">
          <input
            type={showPass ? 'text' : 'password'}
            value={data.wifiPass}
            onChange={e => patch({ wifiPass: e.target.value })}
            placeholder="••••••••"
            className="input flex-1"
          />
          <button
            onClick={() => setShowPass(s => !s)}
            className="rounded-xl border border-graphite/20 px-3 text-warmGray hover:bg-graphite/10"
          >
            {showPass ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-limeMist/25 bg-limeMist/10 px-4 py-3">
        <p className="text-sm text-charcoal">
          ℹ️ MQTT credentials (broker URL, username, password) sẽ được <strong>tự động cấu hình</strong> — bạn không cần nhập thủ công.
        </p>
      </div>

      {sendError && (
        <div className="rounded-xl border border-alertRed/30 bg-alertRed/5 px-4 py-3">
          <p className="text-sm text-alertRed">{sendError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">← Quay lại</Button>
        <Button
          onClick={() => { setSendError(''); mut.mutate() }}
          loading={mut.isPending}
          disabled={!data.ssid.trim()}
          className="flex-1"
        >
          Ghi nhớ WiFi & Tiếp tục
        </Button>
      </div>
    </div>
  )
}
