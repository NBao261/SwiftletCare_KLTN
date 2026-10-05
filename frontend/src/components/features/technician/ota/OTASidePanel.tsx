// OTASidePanel.tsx — Slide-in panel: form thông tin firmware, trạng thái chờ, thành công, thất bại
import { Card, Button } from '@/components/ui'
import { OTAProgressPanel } from './OTAProgressPanel'
import { OTAErrorPanel } from './OTAErrorPanel'
import type { OtaFormValues, OtaFormErrors, OTARunState } from '@/components/features/technician/ota/otaTypes'
import type { SensorNode } from '@/types'

interface Props {
  node: SensorNode
  state: OTARunState
  form: OtaFormValues
  errors: OtaFormErrors
  onFormChange: (patch: Partial<OtaFormValues>) => void
  onPush: () => void
  /** Lỗi từ API gửi lệnh (400/409/501/503…) */
  apiError: string | null
  /** Phiên bản vừa yêu cầu — dùng cho trạng thái pending/done */
  targetVersion: string
  onRetry: () => void
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label-caption">{label}</label>
      {children}
      {error ? <p className="text-xs text-alertRed">{error}</p> : hint ? <p className="text-xs text-warmGray">{hint}</p> : null}
    </div>
  )
}

export function OTASidePanel({ node, state, form, errors, onFormChange, onPush, apiError, targetVersion, onRetry }: Props) {
  return (
    <Card className="sticky top-6 flex flex-col gap-4 !p-5">
      {/* Device info */}
      <div>
        <p className="label-caption mb-1">THIẾT BỊ ĐÃ CHỌN</p>
        <p className="font-mono font-bold text-charcoal">{node.device_id}</p>
        <p className="text-sm text-warmGray">Firmware hiện tại: {node.firmware_version ?? '—'}</p>
      </div>

      {state === 'idle' && (
        <>
          <Field id="ota-version" label="Phiên bản firmware" hint="Dạng x.y.z, VD 1.3.0" error={errors.version}>
            <input
              id="ota-version"
              value={form.version}
              onChange={e => onFormChange({ version: e.target.value })}
              placeholder="1.3.0"
              className="input font-mono text-sm"
              autoComplete="off"
            />
          </Field>
          <Field id="ota-url" label="URL file firmware (https)" hint="Host phải nằm trong danh sách cho phép của hệ thống" error={errors.url}>
            <input
              id="ota-url"
              value={form.url}
              onChange={e => onFormChange({ url: e.target.value })}
              placeholder="https://…/firmware-1.3.0.bin"
              className="input font-mono text-xs"
              autoComplete="off"
            />
          </Field>
          <Field id="ota-sha256" label="SHA-256 của file" hint="64 ký tự hex — thiết bị dùng để kiểm tra toàn vẹn" error={errors.sha256}>
            <input
              id="ota-sha256"
              value={form.sha256}
              onChange={e => onFormChange({ sha256: e.target.value })}
              placeholder="e3b0c442…"
              className="input font-mono text-xs"
              autoComplete="off"
            />
          </Field>

          {apiError && (
            <p className="rounded-xl border border-alertRed/20 bg-alertRed/[0.08] px-3.5 py-2.5 text-sm text-alertRed">{apiError}</p>
          )}

          <Button onClick={onPush} className="w-full justify-center">
            Đẩy OTA cho thiết bị này
          </Button>
        </>
      )}

      {(state === 'pending' || state === 'done') && (
        <OTAProgressPanel
          done={state === 'done'}
          version={targetVersion || node.ota_pending?.version || ''}
          requestedAt={node.ota_pending?.requested_at}
        />
      )}

      {state === 'failed' && node.ota_failed && (
        <OTAErrorPanel
          failedVersion={node.ota_failed.version}
          failedAt={node.ota_failed.failed_at}
          runningVersion={node.ota_failed.running_version ?? node.firmware_version}
          onRetry={onRetry}
        />
      )}
    </Card>
  )
}
