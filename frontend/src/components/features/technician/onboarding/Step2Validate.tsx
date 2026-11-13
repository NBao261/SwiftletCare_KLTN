// Step2Validate — bước 2: xác thực mã thiết bị + mã kích hoạt trên nhãn; lỗi phân theo mã HTTP (400/404 sai mã, 403 không có quyền, 409 đã đăng ký)
import { useState } from 'react'
import { deviceApi } from '@/apis/shared/devices.api'
import { Button } from '@/components/ui'
import { canValidateDevice, cameraRegisterInput, sensorRegisterInput } from '@/components/features/technician/onboarding/onboarding.utils'
import { getApiErrorMessage } from '@/lib/helpers'
import { parseDeviceLabelCode } from '@/lib/qrCode'
import { Thermometer, Camera, QrCode, CheckCircle2, X, AlertTriangle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import type { OnboardingState } from './onboardingTypes'

type ValidateError  = 'DEVICE_ALREADY_REGISTERED' | 'INVALID_DEVICE' | 'FORBIDDEN' | 'UNKNOWN' | null
type ValidateStatus = 'idle' | 'loading' | 'success' | 'error'

interface Props {
  data: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}

/** Label hiển thị thân thiện cho device type */
const DEVICE_LABEL = { SENSOR_NODE: 'Bộ điều khiển', CAMERA_NODE: 'Camera' } as const

export function Step2Validate({ data, patch, onNext, onBack }: Props) {
  const [status, setStatus] = useState<ValidateStatus>(data.deviceDbId ? 'success' : 'idle')
  const [error, setError] = useState<ValidateError>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [validatedModel, setValidatedModel] = useState(
    data.deviceDbId ? `${DEVICE_LABEL[data.deviceType]} (Đã xác thực)` : '',
  )
  const [showQrInput, setShowQrInput] = useState(false)
  const [qrRaw, setQrRaw] = useState('')
  const [qrError, setQrError] = useState('')

  const canSubmit = canValidateDevice(data)

  function handleQrPaste() {
    const parsed = parseDeviceLabelCode(qrRaw)
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
      // Camera gắn nhà (house_id), bộ điều khiển gắn Zone — FARM-FR-004
      const res = data.deviceType === 'CAMERA_NODE'
        ? await deviceApi.registerCameraNode(cameraRegisterInput(data))
        : await deviceApi.registerSensorNode(sensorRegisterInput(data))
      patch({ deviceDbId: res.data.data._id })

      const modelFromBe = (res.data.data as { model?: string }).model
      const modelLabel = modelFromBe ? `${modelFromBe} · ` : ''
      setValidatedModel(`${modelLabel}${DEVICE_LABEL[data.deviceType]}`)

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

  const deviceLabel = DEVICE_LABEL[data.deviceType]
  const DeviceIcon = data.deviceType === 'SENSOR_NODE' ? Thermometer : Camera

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-charcoal">Bước 2 — Xác thực thiết bị</h2>
          <p className="mt-1 text-sm text-warmGray">Nhập mã thiết bị và mã kích hoạt in trên nhãn dán mặt sau thiết bị.</p>
        </div>
        {/* I-01: Read-only badge hiển thị device type đã chọn ở Step 1 */}
        <span className="inline-flex items-center gap-1 rounded-full bg-charcoal/5 px-2.5 py-1 text-xs font-semibold text-charcoal">
          <DeviceIcon className="h-3.5 w-3.5" />
          {deviceLabel}
        </span>
      </div>

      {/* I-07: Mã thiết bị + QR toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption" htmlFor="onboarding-device-id">Mã thiết bị</label>
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
            aria-label={showQrInput ? 'Đóng ô dán nội dung QR' : 'Dán nội dung QR'}
            aria-expanded={showQrInput}
          >
            {showQrInput ? <X className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </button>
        </div>
        {error === 'DEVICE_ALREADY_REGISTERED' && (
          <p className="flex items-center gap-1.5 text-sm text-climateOrange">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage || 'Thiết bị đã được đăng ký'}</span>
          </p>
        )}
      </div>

      {/* QR URI paste panel */}
      {showQrInput && (
        <div className="flex flex-col gap-2 rounded-xl border border-graphite/15 bg-graphite/[0.04] p-3">
          <label className="label-caption" htmlFor="onboarding-qr-text">Dán nội dung QR (URI từ nhãn thiết bị)</label>
          <div className="flex gap-2">
            <input
              id="onboarding-qr-text"
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

      {/* I-06: Mã kích hoạt */}
      <div className="flex flex-col gap-1.5">
        <label className="label-caption" htmlFor="onboarding-secret-key">Mã kích hoạt</label>
        <input
          id="onboarding-secret-key"
          value={data.secretKey}
          disabled={status === 'success'}
          onChange={e => { patch({ secretKey: e.target.value }); setStatus('idle') }}
          placeholder="VD: ABCD-EFGH-JKMN"
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
          <p className="flex items-center gap-1.5 font-semibold text-climateOrange">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Thiết bị đã tồn tại trên hệ thống</span>
          </p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm text-climateOrange/80">
            <li>Thiết bị đang được gán cho một Farm khác</li>
            <li>Có thể mã thiết bị bị nhập sai chữ hoa/thường</li>
          </ul>
          <p className="mt-2 text-sm text-climateOrange/70">Liên hệ Admin để gỡ gán thiết bị.</p>
        </div>
      )}

      {error === 'INVALID_DEVICE' && (
        <div className="rounded-xl border border-l-4 border-alertRed/30 border-l-alertRed bg-alertRed/5 px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-alertRed">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Mã thiết bị hoặc mã kích hoạt không đúng</span>
          </p>
          <p className="mt-1 text-sm text-alertRed/80">
            {errorMessage || 'Kiểm tra lại mã thiết bị và mã kích hoạt trên nhãn dán mặt sau thiết bị.'}
          </p>
        </div>
      )}

      {error === 'FORBIDDEN' && (
        <div className="rounded-xl border border-l-4 border-alertRed/30 border-l-alertRed bg-alertRed/5 px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-alertRed">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Bạn không có quyền với trang trại này</span>
          </p>
          <p className="mt-1 text-sm text-alertRed/80">
            {errorMessage || 'Tài khoản này không được đăng ký thiết bị vào trang trại đã chọn. Quay lại bước 1 chọn vị trí khác.'}
          </p>
        </div>
      )}

      {error === 'UNKNOWN' && (
        <div className="rounded-xl border border-l-4 border-graphite/30 border-l-graphite bg-graphite/5 px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-charcoal">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Lỗi kết nối</span>
          </p>
          <p className="mt-1 text-sm text-warmGray">Không thể kết nối đến máy chủ. Kiểm tra mạng và thử lại.</p>
        </div>
      )}

      <div className="flex gap-3 border-t border-graphite/10 pt-4">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Button>
        <Button onClick={onNext} disabled={status !== 'success'} className="flex-1">
          Tiếp theo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
