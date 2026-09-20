// Step4WiFi.tsx — Bước 4: Cấu hình WiFi nhà yến cho ESP32 (B9)
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
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
    mutationFn: () =>
      // Placeholder: production sẽ gọi fetch local AP endpoint của ESP32
      ticketApi.addNote('onboarding', `WiFi cấu hình: ${data.ssid}`),
    onSuccess: () => onNext(),
    onError: () => setSendError('Không thể gửi cấu hình — ESP32 có thể đã quay về AP-mode (timeout 60s). Thử lại từ Bước 3.'),
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 4 — Cấu hình WiFi nhà yến</h2>
        <p className="mt-1 text-sm text-warmGray">
          Nhập thông tin WiFi của nhà yến để ESP32 tự kết nối sau khi cài đặt.
        </p>
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
          Gửi cấu hình đến ESP32
        </Button>
      </div>
    </div>
  )
}
