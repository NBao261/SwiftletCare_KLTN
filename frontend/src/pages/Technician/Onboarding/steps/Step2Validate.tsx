// Step2Validate.tsx — Bước 2: Xác thực thiết bị (Device ID + Secret Key) — B9 + C1
import { useState } from 'react'
import { deviceApi } from '@/services/api'
import { Button } from '@/components/ui'
import { getApiErrorMessage } from '@/utils/helpers'
import type { OnboardingState, DeviceType } from './onboardingTypes'

type ValidateError  = 'INVALID_SECRET_KEY' | 'DEVICE_ALREADY_REGISTERED' | null
type ValidateStatus = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}

export function Step2Validate({ data, patch, onNext, onBack }: Props) {
  const [status, setStatus] = useState<ValidateStatus>('idle')
  const [error, setError] = useState<ValidateError>(null)
  const [validatedModel, setValidatedModel] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  async function handleValidate() {
    if (!data.deviceId.trim() || !data.secretKey.trim()) return
    setStatus('loading')
    setError(null)
    try {
      const res = await deviceApi.registerSensorNode({
        device_id: data.deviceId.trim(),
        zone_id: data.location.zoneId!,
      })
      patch({ deviceDbId: res.data.data._id })
      setValidatedModel(`ESP32-WROOM-32D · ${data.deviceType === 'SENSOR_NODE' ? 'SensorNode' : 'CameraNode'}`)
      setStatus('success')
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, '')
      setError(msg.includes('already') ? 'DEVICE_ALREADY_REGISTERED' : 'INVALID_SECRET_KEY')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 2 — Xác thực thiết bị</h2>
        <p className="mt-1 text-sm text-warmGray">Nhập thông tin trên nhãn dán mặt sau thiết bị ESP32.</p>
      </div>

      {/* Device type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Loại thiết bị</label>
        <div className="flex gap-2">
          {(['SENSOR_NODE', 'CAMERA_NODE'] as DeviceType[]).map(t => (
            <button
              key={t}
              onClick={() => patch({ deviceType: t })}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                data.deviceType === t
                  ? 'border-charcoal bg-charcoal/5 text-charcoal'
                  : 'border-graphite/20 text-warmGray hover:border-graphite/40'
              }`}
            >
              {t === 'SENSOR_NODE' ? '🌡 SensorNode' : '📷 CameraNode'}
            </button>
          ))}
        </div>
      </div>

      {/* Device ID */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Device ID</label>
        <div className="flex gap-2">
          <input
            value={data.deviceId}
            onChange={e => { patch({ deviceId: e.target.value }); setStatus('idle') }}
            placeholder="VD: ESP32-A7F3-001"
            className={`input flex-1 font-mono ${
              error === 'DEVICE_ALREADY_REGISTERED' ? 'border-2 border-climateOrange focus:border-climateOrange' : ''
            }`}
          />
          <button className="rounded-xl border border-graphite/20 px-3 text-warmGray hover:bg-graphite/10" title="Quét QR">
            📷
          </button>
        </div>
        {error === 'DEVICE_ALREADY_REGISTERED' && (
          <p className="text-sm text-climateOrange">⚠️ Thiết bị đã được đăng ký thuộc Farm khác</p>
        )}
      </div>

      {/* Secret Key */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Mã kích hoạt (Secret Key)</label>
        <div className="flex gap-2">
          <input
            type={showSecret ? 'text' : 'password'}
            value={data.secretKey}
            onChange={e => { patch({ secretKey: e.target.value }); setStatus('idle') }}
            placeholder="••••••••••••"
            className={`input flex-1 font-mono ${
              error === 'INVALID_SECRET_KEY' ? 'border-2 border-alertRed focus:border-alertRed' : ''
            }`}
          />
          <button
            onClick={() => setShowSecret(s => !s)}
            className="rounded-xl border border-graphite/20 px-3 text-warmGray hover:bg-graphite/10"
          >
            {showSecret ? '🙈' : '👁'}
          </button>
        </div>
        {error === 'INVALID_SECRET_KEY' && (
          <p className="text-sm text-alertRed">❌ Mã kích hoạt không đúng. Kiểm tra lại nhãn thiết bị.</p>
        )}
      </div>

      <Button
        onClick={handleValidate}
        loading={status === 'loading'}
        disabled={!data.deviceId.trim() || !data.secretKey.trim() || status === 'loading'}
        className="w-full justify-center"
      >
        Xác thực thiết bị
      </Button>

      {status === 'success' && (
        <div className="flex items-start gap-3 rounded-xl border border-limeMist/30 bg-limeMist/10 px-4 py-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-semibold text-charcoal">Thiết bị hợp lệ!</p>
            <p className="text-sm text-charcoal/70">Model: {validatedModel}</p>
          </div>
        </div>
      )}

      {error === 'DEVICE_ALREADY_REGISTERED' && (
        <div className="rounded-xl border border-l-4 border-climateOrange/30 border-l-climateOrange bg-climateOrange/[0.08] px-4 py-3">
          <p className="font-semibold text-climateOrange">✗ Thiết bị đã tồn tại trên hệ thống</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm text-climateOrange/80">
            <li>• Thiết bị đang được gán cho một Farm khác</li>
            <li>• Có thể Device ID bị nhập sai chữ hoa/thường</li>
          </ul>
          <button className="mt-2 text-sm font-semibold text-climateOrange underline">
            Liên hệ Admin để gỡ gán thiết bị
          </button>
        </div>
      )}

      {error === 'INVALID_SECRET_KEY' && (
        <div className="rounded-xl border border-l-4 border-alertRed/30 border-l-alertRed bg-alertRed/5 px-4 py-3">
          <p className="font-semibold text-alertRed">✗ Xác thực thất bại</p>
          <p className="mt-1 text-sm text-alertRed/80">Mã kích hoạt không khớp với Device ID này.</p>
        </div>
      )}

      <div className="flex gap-3 border-t border-graphite/10 pt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1">← Quay lại</Button>
        <Button onClick={onNext} disabled={status !== 'success'} className="flex-1">Tiếp theo →</Button>
      </div>
    </div>
  )
}
