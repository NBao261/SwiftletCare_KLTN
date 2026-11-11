// Step2Validate.tsx — Bước 2: Xác thực thiết bị (Device ID + secretKey) — B9 + C1
// BE (Flow 1 bước 3–4) xác thực cặp {device_id, secret_key} in trên nhãn thiết bị:
// sensor → POST /devices/sensor-nodes/register, camera → POST /devices/camera-nodes/register.
// Phân loại lỗi bằng HTTP status code, không string-match message:
//   400 = sai Device ID / secretKey, 403 = không có quyền với farm này, 409 = đã đăng ký
import { useState } from 'react'
import { deviceApi } from '@/apis/shared/devices.api'
import type { RegisterDeviceInput } from '@/apis/shared/devices.api'
import { Button } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/helpers'
import { Thermometer, Camera, QrCode, CheckCircle2, X } from 'lucide-react'
import type { OnboardingState, DeviceType } from './onboardingTypes'

type ValidateError  = 'DEVICE_ALREADY_REGISTERED' | 'INVALID_DEVICE' | 'FORBIDDEN' | 'UNKNOWN' | null
type ValidateStatus = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}

/** Parse URI QR từ nhãn thiết bị: swiftletcare://claim?d=<id>&k=<key> */
function parseDeviceQR(raw: string): { deviceId: string; secretKey: string } | null {
  try {
    const url = new URL(raw.trim())
    const d   = url.searchParams.get('d')
    const k   = url.searchParams.get('k')
    if (d && k) return { deviceId: d, secretKey: k }
  } catch { /* không phải URI hợp lệ */ }
  return null
}

export function Step2Validate({ data, patch, onNext, onBack }: Props) {
  const [status, setStatus] = useState<ValidateStatus>(data.deviceDbId ? 'success' : 'idle')
  const [error, setError] = useState<ValidateError>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [validatedModel, setValidatedModel] = useState(
    data.deviceDbId ? `${data.deviceType === 'SENSOR_NODE' ? 'SensorNode' : 'CameraNode'} (Đã xác thực)` : '',
  )
  const [showQrInput, setShowQrInput] = useState(false)
  const [qrRaw, setQrRaw] = useState('')
  const [qrError, setQrError] = useState('')

  // CAMERA_NODE chỉ cần houseId (không cần zoneId) — FARM-FR-004
  const canSubmit = data.deviceType === 'CAMERA_NODE'
    ? Boolean(data.deviceId.trim() && data.secretKey.trim() && data.location.houseId)
    : Boolean(data.deviceId.trim() && data.secretKey.trim() && data.location.zoneId)

  function handleQrPaste() {
    const parsed = parseDeviceQR(qrRaw)
    if (!parsed) {
      setQrError('Nội dung QR không đúng định dạng swiftletcare://claim?d=…&k=…')
      return
    }
    patch({ deviceId: parsed.deviceId, secretKey: parsed.secretKey })
    setStatus('idle')
    setQrError('')
    setShowQrInput(false)
    setQrRaw('')
  }

  async function handleValidate() {
    if (!canSubmit) return
    setStatus('loading')
    setError(null)
    setErrorMessage('')
    try {
      let res
      if (data.deviceType === 'CAMERA_NODE') {
        // CAMERA_NODE: house_id thay vì zone_id — FARM-FR-004
        // RegisterDeviceInput yêu cầu zone_id nhưng BE camera endpoint nhận house_id;
        // cast để tránh TS error mà không sửa file API (thuộc scope của Kiệt).
        const payload = {
          device_id: data.deviceId.trim(),
          house_id: data.location.houseId!,
          secret_key: data.secretKey.trim(),
        } as unknown as RegisterDeviceInput & { rtsp_url?: string }
        res = await deviceApi.registerCameraNode(payload)
      } else {
        const payload: RegisterDeviceInput = {
          device_id: data.deviceId.trim(),
          zone_id: data.location.zoneId!,
          secret_key: data.secretKey.trim(),
        }
        res = await deviceApi.registerSensorNode(payload)
      }
      patch({ deviceDbId: res.data.data._id })

      const modelFromBe = (res.data.data as { model?: string }).model
      const modelLabel = modelFromBe ? `${modelFromBe} · ` : ''
      setValidatedModel(`${modelLabel}${data.deviceType === 'SENSOR_NODE' ? 'SensorNode' : 'CameraNode'}`)

      setStatus('success')
    } catch (err: unknown) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status
      setErrorMessage(getApiErrorMessage(err, ''))
      if (httpStatus === 409) {
        setError('DEVICE_ALREADY_REGISTERED')
      } else if (httpStatus === 400 || httpStatus === 404) {
        setError('INVALID_DEVICE')
      } else if (httpStatus === 403) {
        setError('FORBIDDEN')
      } else {
        setError('UNKNOWN')
      }
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 2 — Xác thực thiết bị</h2>
        <p className="mt-1 text-sm text-warmGray">Nhập Device ID và secretKey in trên nhãn dán mặt sau thiết bị.</p>
      </div>

      {/* Device type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption">Loại thiết bị</label>
        <div className="flex gap-2">
          {(['SENSOR_NODE', 'CAMERA_NODE'] as DeviceType[]).map(t => (
            <button
              key={t}
              type="button"
              disabled={status === 'loading' || status === 'success'}
              onClick={() => { patch({ deviceType: t }); setStatus('idle'); setError(null) }}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                data.deviceType === t
                  ? 'border-charcoal bg-charcoal/5 text-charcoal'
                  : 'border-graphite/20 text-warmGray hover:border-graphite/40'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t === 'SENSOR_NODE' ? <Thermometer className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {t === 'SENSOR_NODE' ? 'SensorNode' : 'CameraNode'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Device ID + QR toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption" htmlFor="onboarding-device-id">Device ID</label>
        <div className="flex gap-2">
          <input
            id="onboarding-device-id"
            value={data.deviceId}
            disabled={status === 'success'}
            onChange={e => { patch({ deviceId: e.target.value }); setStatus('idle') }}
            placeholder="VD: ESP32-A7F3-001"
            className={`input flex-1 tabular-nums ${
              error === 'DEVICE_ALREADY_REGISTERED' ? 'border-2 border-climateOrange focus:border-climateOrange' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => { setShowQrInput(v => !v); setQrError('') }}
            className="flex items-center justify-center rounded-xl border border-graphite/20 px-3 text-warmGray hover:bg-graphite/10"
            title={showQrInput ? 'Đóng' : 'Dán nội dung QR'}
          >
            {showQrInput ? <X className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </button>
        </div>
        {error === 'DEVICE_ALREADY_REGISTERED' && (
          <p className="text-sm text-climateOrange">⚠️ {errorMessage || 'Thiết bị đã được đăng ký'}</p>
        )}
      </div>

      {/* QR URI paste panel */}
      {showQrInput && (
        <div className="flex flex-col gap-2 rounded-xl border border-graphite/15 bg-graphite/[0.04] p-3">
          <label className="label-caption">Dán nội dung QR (URI từ nhãn thiết bị)</label>
          <div className="flex gap-2">
            <input
              value={qrRaw}
              onChange={e => { setQrRaw(e.target.value); setQrError('') }}
              placeholder="swiftletcare://claim?d=…&k=…"
              className="input flex-1 text-xs tabular-nums"
              autoFocus
            />
            <Button type="button" onClick={handleQrPaste} className="shrink-0">Điền</Button>
          </div>
          {qrError && <p className="text-xs text-alertRed">{qrError}</p>}
        </div>
      )}

      {/* secretKey */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption" htmlFor="onboarding-secret-key">secretKey</label>
        <input
          id="onboarding-secret-key"
          value={data.secretKey}
          disabled={status === 'success'}
          onChange={e => { patch({ secretKey: e.target.value }); setStatus('idle') }}
          placeholder="VD: ABCD-EFGH-JKMN (in trên nhãn)"
          autoComplete="off"
          spellCheck={false}
          className="input w-full tabular-nums uppercase"
        />
      </div>

      <Button
        onClick={handleValidate}
        loading={status === 'loading'}
        disabled={!canSubmit || status === 'loading' || status === 'success'}
        className="w-full justify-center"
      >
        Xác thực thiết bị
      </Button>

      {status === 'success' && (
        <div className="flex items-start gap-3 rounded-xl border border-limeMist/30 bg-limeMist/10 px-4 py-3">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
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
          <p className="mt-2 text-sm text-climateOrange/70">Liên hệ Admin để gỡ gán thiết bị.</p>
        </div>
      )}

      {error === 'INVALID_DEVICE' && (
        <div className="rounded-xl border border-l-4 border-alertRed/30 border-l-alertRed bg-alertRed/5 px-4 py-3">
          <p className="font-semibold text-alertRed">✗ Device ID hoặc secretKey không đúng</p>
          <p className="mt-1 text-sm text-alertRed/80">
            {errorMessage || 'Kiểm tra lại Device ID và secretKey trên nhãn dán mặt sau thiết bị.'}
          </p>
        </div>
      )}

      {error === 'FORBIDDEN' && (
        <div className="rounded-xl border border-l-4 border-alertRed/30 border-l-alertRed bg-alertRed/5 px-4 py-3">
          <p className="font-semibold text-alertRed">✗ Bạn không có quyền với trang trại này</p>
          <p className="mt-1 text-sm text-alertRed/80">
            {errorMessage || 'Tài khoản này không được đăng ký thiết bị vào trang trại đã chọn. Quay lại bước 1 chọn vị trí khác.'}
          </p>
        </div>
      )}

      {error === 'UNKNOWN' && (
        <div className="rounded-xl border border-l-4 border-graphite/30 border-l-graphite bg-graphite/5 px-4 py-3">
          <p className="font-semibold text-charcoal">✗ Lỗi kết nối</p>
          <p className="mt-1 text-sm text-warmGray">Không thể kết nối đến máy chủ. Kiểm tra mạng và thử lại.</p>
        </div>
      )}

      <div className="flex gap-3 border-t border-graphite/10 pt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1">← Quay lại</Button>
        <Button onClick={onNext} disabled={status !== 'success'} className="flex-1">Tiếp theo →</Button>
      </div>
    </div>
  )
}
