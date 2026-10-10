// DecommissionDeviceModal.tsx — FARM-FR-008: Technician gỡ thiết bị khỏi hiện trường.
// BE giữ document (telemetry/alert cũ còn tham chiếu), chỉ đánh dấu decommissioned_at, tắt relay về AUTO,
// đóng cảnh báo của node và ghi chú vào ticket liên quan — nên hành động này KHÔNG hoàn tác được.
import { useState, useEffect, FormEvent } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'
import { useDecommissionDevice } from '@/hooks/shared/useDevices'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { SensorNode } from '@/types'

interface Props { node: SensorNode | null; onClose: () => void }

export default function DecommissionDeviceModal({ node, onClose }: Props) {
  const decommission = useDecommissionDevice()
  const push = useToastStore(s => s.push)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Modal không unmount giữa các lần mở — xoá lý do cũ mỗi khi đổi thiết bị
  useEffect(() => { setReason(''); setSubmitted(false) }, [node?._id])

  const reasonError = submitted && !reason.trim() ? 'Chưa nhập lý do gỡ — lý do được lưu vào nhật ký hệ thống' : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!node || !reason.trim()) return
    decommission.mutate({ nodeId: node._id, reason: reason.trim() }, {
      onSuccess: () => { push(`Đã gỡ thiết bị "${node.device_id}"`); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Gỡ thiết bị thất bại'), 'error'),
    })
  }

  return (
    <Modal open={node !== null} onClose={onClose} title="Gỡ thiết bị">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-warmGray">
          Gỡ <strong className="text-charcoal">{node?.device_id}</strong> khỏi hệ thống. Lịch sử cảm biến vẫn được giữ,
          nhưng thiết bị sẽ không còn nhận dữ liệu hay lệnh điều khiển và <strong>không thể hoàn tác</strong>.
          Cảnh báo đang mở của thiết bị sẽ được đóng tự động.
        </p>
        <Textarea
          id="decommission-reason"
          label="Lý do gỡ"
          required
          rows={2}
          placeholder="VD: Mạch cháy nguồn, không sửa được..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          error={reasonError}
        />
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={decommission.isPending}>Hủy</Button>
          <Button type="submit" variant="danger" className="flex-1" loading={decommission.isPending}>Gỡ thiết bị</Button>
        </div>
      </form>
    </Modal>
  )
}
