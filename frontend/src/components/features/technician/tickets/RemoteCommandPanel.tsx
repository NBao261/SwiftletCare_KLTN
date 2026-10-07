import { useState } from 'react'
import { Card, Button, Badge, SelectMenu, ConfirmModal } from '@/components/ui'
import { useSensorNodes, useSendNodeCommand } from '@/hooks/shared/useDevices'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { Ticket } from '@/types'

export function RemoteCommandPanel({ ticket }: { ticket: Ticket }) {
  const { data: nodes, isLoading } = useSensorNodes(ticket.zone_id, {
    // Chỉ tải nếu có zone_id, ticket không có zone_id thì không biết lấy node nào
    enabled: !!ticket.zone_id
  })
  const sendCommand = useSendNodeCommand()
  const pushToast = useToastStore(s => s.push)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('')
  const [showConfirmRestart, setShowConfirmRestart] = useState(false)

  if (!ticket.zone_id) return null

  const handleCommand = (cmd: 'RESTART' | 'PUSH_CONFIG') => {
    if (!selectedNodeId) return pushToast('Vui lòng chọn thiết bị', 'error')
    
    if (cmd === 'RESTART') {
      setShowConfirmRestart(true)
      return
    }
    executeCommand(cmd)
  }

  const executeCommand = (cmd: 'RESTART' | 'PUSH_CONFIG') => {
    sendCommand.mutate(
      { nodeId: selectedNodeId, input: { command: cmd, ticket_id: ticket._id } },
      {
        onSuccess: () => {
          pushToast(`Đã gửi lệnh ${cmd} tới thiết bị thành công`)
          setShowConfirmRestart(false)
        },
        onError: (err) => {
          pushToast(getApiErrorMessage(err, 'Lỗi gửi lệnh'), 'error')
          setShowConfirmRestart(false)
        }
      }
    )
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-charcoal">Xử lý từ xa (Remote Command)</h3>
        <Badge tone="neutral">Chẩn đoán thiết bị</Badge>
      </div>
      
      <p className="mb-4 text-xs text-warmGray">
        Gửi lệnh Khởi động lại (RESTART) hoặc Đẩy lại cấu hình (PUSH_CONFIG) cho các thiết bị thuộc khu vực (Zone) của Ticket này.
      </p>

      {isLoading ? (
        <div className="h-10 w-full animate-pulse rounded-xl bg-warmGray/10" />
      ) : !nodes || nodes.length === 0 ? (
        <p className="text-sm text-warmGray">Không tìm thấy thiết bị nào trong khu vực này.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <SelectMenu
            field
            value={selectedNodeId}
            ariaLabel="Chọn thiết bị trong Zone"
            options={[
              { value: '', label: '-- Chọn thiết bị trong Zone --' },
              ...nodes
                .filter(n => n.status === 'ONLINE' || n.status === 'DEGRADED')
                .map(n => ({ value: n._id, label: `${n.device_id} (Trạng thái: ${n.status})` }))
            ]}
            onChange={setSelectedNodeId}
          />
          
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              disabled={!selectedNodeId}
              loading={sendCommand.isPending && sendCommand.variables?.input.command === 'RESTART'}
              onClick={() => handleCommand('RESTART')}
            >
              Khởi động lại
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              disabled={!selectedNodeId}
              loading={sendCommand.isPending && sendCommand.variables?.input.command === 'PUSH_CONFIG'}
              onClick={() => handleCommand('PUSH_CONFIG')}
            >
              Cấu hình lại
            </Button>
          </div>
        </div>
      )}

      {showConfirmRestart && (
        <ConfirmModal
          open={true}
          title="Xác nhận khởi động lại"
          description="Bạn có chắc chắn muốn gửi lệnh khởi động lại (RESTART) thiết bị này không? Thiết bị sẽ tạm thời mất kết nối trong vài phút."
          confirmLabel="Khởi động lại"
          onConfirm={() => executeCommand('RESTART')}
          onCancel={() => setShowConfirmRestart(false)}
          loading={sendCommand.isPending}
        />
      )}
    </Card>
  )
}
