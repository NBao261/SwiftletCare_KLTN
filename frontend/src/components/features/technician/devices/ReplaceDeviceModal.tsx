// ReplaceDeviceModal.tsx — FARM-FR-008: thay sensor node hỏng bằng node mới CÙNG Zone.
// BE tạo node mới (qua đúng luồng onboarding: secret_key in trên nhãn, trạng thái PENDING) TRƯỚC rồi mới gỡ
// node cũ — sai secret_key thì node cũ giữ nguyên. Cấu hình loa của node cũ được chép sang node mới.
import { useState, useEffect, FormEvent } from 'react'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { useReplaceSensorNode } from '@/hooks/shared/useDevices'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { SensorNode } from '@/types'

interface Props { node: SensorNode | null; onClose: () => void }

export default function ReplaceDeviceModal({ node, onClose }: Props) {
  const replace = useReplaceSensorNode()
  const push = useToastStore(s => s.push)
  const [newDeviceId, setNewDeviceId] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setNewDeviceId(''); setSecretKey(''); setReason(''); setSubmitted(false)
  }, [node?._id])

  const idError = submitted && !newDeviceId.trim() ? 'Chưa nhập Device ID mới'
    : submitted && node && newDeviceId.trim() === node.device_id ? 'Device ID mới phải khác thiết bị cũ'
    : undefined
  const keyError = submitted && !secretKey.trim() ? 'Chưa nhập secretKey in trên nhãn thiết bị mới' : undefined
  const reasonError = submitted && !reason.trim() ? 'Chưa nhập lý do thay' : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!node || idError || !newDeviceId.trim() || !secretKey.trim() || !reason.trim()) return
    replace.mutate(
      { nodeId: node._id, input: { new_device_id: newDeviceId.trim(), secret_key: secretKey.trim(), reason: reason.trim() } },
      {
        onSuccess: () => {
          push(`Đã thay "${node.device_id}" bằng "${newDeviceId.trim()}" — cấp nguồn thiết bị mới để hoàn tất`)
          onClose()
        },
        onError: (err) => push(getApiErrorMessage(err, 'Thay thiết bị thất bại'), 'error'),
      },
    )
  }

  return (
    <Modal open={node !== null} onClose={onClose} title="Thay thiết bị">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-warmGray">
          Thiết bị mới sẽ nằm cùng Zone với <strong className="text-charcoal">{node?.device_id}</strong> và thừa hưởng
          lịch loa ru. Thiết bị cũ được gỡ sau khi thiết bị mới đăng ký thành công; lịch sử cảm biến cũ vẫn được giữ.
        </p>
        <Input
          id="replace-new-device-id"
          label="Device ID mới"
          required
          value={newDeviceId}
          onChange={e => setNewDeviceId(e.target.value)}
          placeholder="VD: node_002 (in trên vỏ ESP32 mới)"
          error={idError}
        />
        <Input
          id="replace-secret-key"
          label="secretKey"
          required
          value={secretKey}
          onChange={e => setSecretKey(e.target.value)}
          placeholder="VD: ABCD-EFGH-JKMN (in trên nhãn thiết bị mới)"
          autoComplete="off"
          spellCheck={false}
          error={keyError}
        />
        <Textarea
          id="replace-reason"
          label="Lý do thay"
          required
          rows={2}
          placeholder="VD: Mạch cũ hỏng cảm biến nhiệt độ..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          error={reasonError}
        />
        <Button type="submit" loading={replace.isPending} className="w-full">Xác nhận thay thiết bị</Button>
      </form>
    </Modal>
  )
}
