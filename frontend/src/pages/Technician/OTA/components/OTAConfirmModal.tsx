// OTAConfirmModal.tsx — B4: Xác nhận trước khi đẩy OTA
import { Button, Modal } from '@/components/ui'
import type { FirmwareVersion } from './otaTypes'
import type { SensorNode } from '@/types'

interface Props {
  node: SensorNode
  firmware: FirmwareVersion
  onClose: () => void
  onConfirm: () => void
}

export function OTAConfirmModal({ node, firmware, onClose, onConfirm }: Props) {
  return (
    <Modal open onClose={onClose} title="Xác nhận đẩy OTA Firmware">
      <div className="flex flex-col gap-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-climateOrange/10">
            <span className="text-3xl">🛡</span>
          </div>
        </div>

        {/* Device info */}
        <div className="rounded-xl border border-graphite/15 bg-graphite/[0.03] px-4 py-3">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-warmGray">Thiết bị</dt>
              <dd className="font-mono font-semibold text-charcoal">{node.device_id}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-warmGray">Cập nhật lên</dt>
              <dd className="font-bold text-charcoal">
                <span className="font-mono text-xs text-warmGray line-through">{node.firmware_version}</span>
                {' → '}
                <span className="font-mono">{firmware.version}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Changelog */}
        <div className="rounded-xl bg-graphite/5 px-4 py-3">
          <p className="label-caption mb-2">CHANGELOG</p>
          <ul className="flex flex-col gap-1">
            {firmware.changelog.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-charcoal">
                <span className="shrink-0 text-warmGray">•</span>{c}
              </li>
            ))}
          </ul>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-xl border border-climateOrange/30 bg-climateOrange/8 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-climateOrange">⚠️</span>
          <p className="text-sm text-climateOrange">
            Thiết bị sẽ mất kết nối <strong>2–5 phút</strong> trong quá trình cập nhật.
            Cảnh báo và dữ liệu cảm biến sẽ gián đoạn tạm thời.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button onClick={onConfirm} className="flex-1 bg-charcoal text-white hover:bg-charcoal/90">
            Đẩy OTA ngay
          </Button>
        </div>
      </div>
    </Modal>
  )
}
