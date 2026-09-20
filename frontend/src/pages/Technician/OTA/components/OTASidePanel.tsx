// OTASidePanel.tsx — Slide-in panel: firmware select, changelog, progress, error states
import { Card, Button } from '@/components/ui'
import { OTAProgressPanel } from './OTAProgressPanel'
import { OTAErrorPanel } from './OTAErrorPanel'
import { FIRMWARE_VERSIONS } from './otaTypes'
import type { FirmwareVersion, OTAError, OTARunState, OTAStepState } from './otaTypes'
import type { SensorNode } from '@/types'

interface Props {
  node: SensorNode
  selectedFw: FirmwareVersion
  onFwChange: (fw: FirmwareVersion) => void
  onPush: () => void
  otaState: OTARunState
  otaSteps: OTAStepState[]
  otaError: OTAError
  onRetry: () => void
  onSimulateError: (err: OTAError) => void
}

export function OTASidePanel({
  node, selectedFw, onFwChange, onPush,
  otaState, otaSteps, otaError, onRetry, onSimulateError,
}: Props) {
  return (
    <Card className="sticky top-6 flex flex-col gap-4 !p-5">
      {/* Device info */}
      <div>
        <p className="label-caption mb-1">THIẾT BỊ ĐÃ CHỌN</p>
        <p className="font-mono font-bold text-charcoal">{node.device_id}</p>
        <p className="text-sm text-warmGray">Firmware hiện tại: {node.firmware_version ?? '—'}</p>
      </div>

      {/* Idle state: firmware select + changelog + push button */}
      {otaState === 'idle' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="label-caption">Chọn phiên bản firmware</label>
            <select
              value={selectedFw.version}
              onChange={e => {
                const fw = FIRMWARE_VERSIONS.find(f => f.version === e.target.value)
                if (fw) onFwChange(fw)
              }}
              className="input text-sm"
            >
              {FIRMWARE_VERSIONS.map(fw => (
                <option key={fw.version} value={fw.version}>
                  {fw.version} — {fw.date}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-graphite/5 px-3.5 py-3">
            <p className="label-caption mb-2">CHANGELOG</p>
            <ul className="flex flex-col gap-1">
              {selectedFw.changelog.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-charcoal">
                  <span className="mt-0.5 shrink-0 text-warmGray">•</span>{c}
                </li>
              ))}
            </ul>
          </div>

          <Button onClick={onPush} className="w-full justify-center">
            Đẩy OTA cho thiết bị này
          </Button>

          {/* DEV-only: simulate errors — guarded by env flag */}
          {import.meta.env.DEV && (
            <div className="border-t border-graphite/10 pt-3">
              <p className="label-caption mb-2">[ DEV ] Giả lập lỗi OTA</p>
              <div className="flex flex-col gap-1">
                {(['DOWNLOAD_TIMEOUT', 'CHECKSUM_MISMATCH', 'ROLLBACK'] as OTAError[]).map(err => (
                  <button
                    key={err!}
                    onClick={() => onSimulateError(err)}
                    className="rounded-lg border border-graphite/15 px-2 py-1 text-[10px] text-warmGray hover:bg-graphite/5"
                  >
                    {err}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Progress state */}
      {(otaState === 'progress' || otaState === 'done') && (
        <OTAProgressPanel steps={otaSteps} done={otaState === 'done'} firmware={selectedFw.version} />
      )}

      {/* Error state */}
      {otaState === 'error' && otaError && (
        <OTAErrorPanel
          error={otaError}
          currentFw={node.firmware_version ?? 'v1.2.0'}
          targetFw={selectedFw.version}
          onRetry={onRetry}
        />
      )}
    </Card>
  )
}
