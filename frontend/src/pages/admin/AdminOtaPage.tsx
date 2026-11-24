// Backend không có catalog firmware: Admin nhập version, url, sha256; trạng thái lấy từ ota_pending, ota_failed
import { useState } from 'react'
import { useSensorNodes, useSendNodeCommand } from '@/hooks/shared/useDevices'
import { getApiErrorMessage } from '@/lib/helpers'
import { useToastStore } from '@/stores/toastStore'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import { IconOTA } from '@/components/ui/icons'
import { DeviceTable }     from '@/components/features/admin/ota/DeviceTable'
import { OTASidePanel }   from '@/components/features/admin/ota/OTASidePanel'
import { OTAConfirmModal } from '@/components/features/admin/ota/OTAConfirmModal'
import { EMPTY_OTA_FORM, validateOtaForm } from '@/components/features/admin/ota/otaTypes'
import type { OtaFormValues, OtaFormErrors, OTARunState } from '@/components/features/admin/ota/otaTypes'
import type { SensorNode } from '@/types'

function otaErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 501) return 'Firmware trên thiết bị chưa hỗ trợ cập nhật từ xa. Nạp bản 1.4.0 trở lên tại chỗ (ElegantOTA trong mạng LAN hoặc cáp USB) trước.'
  if (status === 503) return 'Máy chủ chưa kết nối được tới thiết bị. Thử lại sau.'
  if (status === 403) return 'Bạn không có quyền gửi lệnh cho thiết bị này.'
  return getApiErrorMessage(err, 'Gửi lệnh OTA thất bại')
}

export default function AdminOtaPage() {
  const push = useToastStore(s => s.push)
  const sendCommand = useSendNodeCommand()

  const { data: nodes, isLoading } = useSensorNodes(undefined, {
    // Còn node đang chờ OTA → polling để thấy kết quả (BE chưa có socket OTA_PROGRESS)
    refetchInterval: query => (query.state.data?.some(n => n.ota_pending) ? 5_000 : false),
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<OtaFormValues>(EMPTY_OTA_FORM)
  const [errors, setErrors] = useState<OtaFormErrors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  // Phiên bản vừa gửi thành công: dùng nhận diện pending/done trước khi BE phản ánh ota_pending
  const [sentVersion, setSentVersion] = useState('')
  // failed_at của lỗi đã được Technician bấm "Thử lại" (ẩn panel lỗi, không xoá dữ liệu BE)
  const [dismissedFailedAt, setDismissedFailedAt] = useState<string | null>(null)

  // Luôn lấy node mới nhất từ cache để thấy ota_pending / firmware_version cập nhật
  const selectedNode: SensorNode | null = nodes?.find(n => n._id === selectedId) ?? null

  function deriveState(node: SensorNode): OTARunState {
    const failedForSent = node.ota_failed && node.ota_failed.version === sentVersion
    if (node.ota_pending) return 'pending'
    if (sentVersion && node.firmware_version === sentVersion) return 'done'
    if (sentVersion && !failedForSent) return 'pending'
    if (node.ota_failed && node.ota_failed.failed_at !== dismissedFailedAt) return 'failed'
    return 'idle'
  }

  function openPanel(node: SensorNode) {
    setSelectedId(node._id)
    setForm(EMPTY_OTA_FORM)
    setErrors({})
    setApiError(null)
    setSentVersion('')
    setDismissedFailedAt(null)
  }

  function handleFormChange(patch: Partial<OtaFormValues>) {
    setForm(prev => ({ ...prev, ...patch }))
    setApiError(null)
  }

  function handlePush() {
    const errs = validateOtaForm(form)
    setErrors(errs)
    if (Object.keys(errs).length === 0) setConfirmOpen(true)
  }

  function startOTA() {
    if (!selectedNode) return
    const payload = { version: form.version.trim(), url: form.url.trim(), sha256: form.sha256.trim().toLowerCase() }
    sendCommand.mutate(
      { nodeId: selectedNode._id, input: { command: 'OTA', ota: payload } },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          setSentVersion(payload.version)
          setApiError(null)
          push('Đã gửi bản cập nhật tới thiết bị')
        },
        onError: err => {
          setConfirmOpen(false)
          setApiError(otaErrorMessage(err))
        },
      },
    )
  }

  function handleRetry() {
    if (selectedNode?.ota_failed) setDismissedFailedAt(selectedNode.ota_failed.failed_at)
    setSentVersion('')
    setApiError(null)
  }

  const runState: OTARunState = selectedNode ? deriveState(selectedNode) : 'idle'

  return (
    <SectionCard
      description="Cập nhật firmware từ xa cho bộ điều khiển. Chỉ thiết bị đang online nhận được bản cập nhật."
    >
      {/* Tên trang ở header; bảng bên trái, ngăn gửi bản cập nhật bên phải khi chọn thiết bị */}
      <div className="flex gap-5">
        {/* Device table */}
        <div className="min-w-0 flex-1">
          {isLoading && <LoadingSkeleton count={4} className="h-14 w-full" />}

          {!isLoading && (!nodes || nodes.length === 0) && (
            <EmptyState
              icon={<IconOTA width={28} height={28} />}
              title="Không có thiết bị nào"
              description="Chưa có bộ điều khiển nào được đăng ký trong hệ thống."
            />
          )}

          {!isLoading && nodes && nodes.length > 0 && (
            <DeviceTable
              nodes={nodes}
              selectedId={selectedNode?._id}
              onSelect={openPanel}
            />
          )}
        </div>

        {/* Side panel: slide in khi chọn node */}
        {selectedNode && (
          <div className="w-80 shrink-0 animate-[slideInRight_0.2s_ease-out]">
            <OTASidePanel
              node={selectedNode}
              state={runState}
              form={form}
              errors={errors}
              onFormChange={handleFormChange}
              onPush={handlePush}
              apiError={apiError}
              targetVersion={sentVersion}
              onRetry={handleRetry}
            />
          </div>
        )}
      </div>

      {/* B4: OTA Confirm Modal */}
      {confirmOpen && selectedNode && (
        <OTAConfirmModal
          node={selectedNode}
          firmware={form}
          loading={sendCommand.isPending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={startOTA}
        />
      )}
    </SectionCard>
  )
}
