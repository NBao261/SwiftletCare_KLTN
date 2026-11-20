// AdminOtaPage (/ota) — FARM-FR-013, SF-02: Administrator cập nhật firmware từ xa
// OTA Firmware Management: layout + state management
// Logic hiển thị được tách sang ./components/
//
// Kết nối BE thật: POST /devices/sensor-nodes/:id/commands { command: 'OTA', ota: { version, url, sha256 } }.
// - BE không có catalog firmware / % tiến trình → Administrator nhập version + url + sha256 của bản build.
// - Trạng thái chạy lấy từ SensorNode: `ota_pending` (đang chờ, trang tự làm mới 5s) / `ota_failed`
//   (job BE đánh dấu thất bại sau 30 phút) / `firmware_version` khớp bản yêu cầu → thành công.
// - Lỗi BE: 400 (host không được phép / dữ liệu sai), 409 (node không ONLINE / trùng version),
//   501 (thiết bị chạy firmware trước 1.4.0, chưa xử lý lệnh từ xa), 503 (mất MQTT).
import { useMemo, useState } from 'react'
import { useSensorNodes, useSendNodeCommand, useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { getApiErrorMessage } from '@/lib/helpers'
import { useToastStore } from '@/stores/toastStore'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import SectionCard from '@/components/ui/SectionCard'
import DataTable from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconOTA } from '@/components/ui/icons'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { OtaChip, UpdateButton, buildOtaColumns } from '@/components/features/admin/ota/otaColumns'
import { OTASidePanel } from '@/components/features/admin/ota/OTASidePanel'
import { t } from '@/i18n'
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
  // Phiên bản vừa gửi thành công — dùng nhận diện pending/done trước khi BE phản ánh ota_pending
  const [sentVersion, setSentVersion] = useState('')
  // failed_at của lỗi đã được Technician bấm "Thử lại" (ẩn panel lỗi, không xoá dữ liệu BE)
  const [dismissedFailedAt, setDismissedFailedAt] = useState<string | null>(null)

  // Vị trí theo tên (FE_Design 13.16 a) từ danh sách thiết bị toàn hệ thống của Admin — Admin không đọc cấu trúc farm
  const { data: systemStatus } = useSystemNodeStatus()
  const locationById = useMemo(
    () => new Map((systemStatus?.nodes ?? []).map(item => [item._id, [item.farm_name, item.house_name, item.zone_name].filter(Boolean).join(' · ')])),
    [systemStatus],
  )
  const locationOf = (node: SensorNode) => locationById.get(node._id) || '—'

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
      description="Cập nhật firmware từ xa cho bộ điều khiển"
      help="Chỉ thiết bị đang online nhận được bản cập nhật. Chọn thiết bị để nhập phiên bản, đường dẫn file và mã kiểm tra."
    >
      {isLoading && <LoadingSkeleton count={4} className="h-14 w-full" />}

      {!isLoading && (!nodes || nodes.length === 0) && (
        <EmptyState
          icon={<IconOTA width={28} height={28} />}
          title="Không có thiết bị nào"
          description="Chưa có bộ điều khiển nào được đăng ký trong hệ thống."
        />
      )}

      {!isLoading && nodes && nodes.length > 0 && (
        <DataTable
          columns={buildOtaColumns(locationOf, openPanel)}
          rows={nodes}
          getRowKey={node => node._id}
          mobileCard={node => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-body font-semibold text-charcoal">
                  <span className="truncate">{node.device_id}</span>
                  <SimulatedBadge simulated={node.simulated} />
                </p>
                <StatusDot status={node.status} />
              </div>
              <p className="text-small text-warmGray">{locationOf(node)}</p>
              <p className="flex flex-wrap items-center gap-2 text-small text-warmGray">
                {t('Firmware {{version}}', { version: node.firmware_version ?? '—' })}
                <OtaChip node={node} />
              </p>
              <UpdateButton node={node} onSelect={openPanel} className="w-full" />
            </div>
          )}
        />
      )}

      {/* Ngăn gửi bản cập nhật trượt từ phải; đóng thì bỏ chọn. Hộp xác nhận đang mở thì Esc chỉ đóng hộp đó, giữ form */}
      <Drawer open={Boolean(selectedNode)} onClose={() => { if (!confirmOpen) setSelectedId(null) }} title={t('Cập nhật firmware')}>
        {selectedNode && (
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
        )}
      </Drawer>

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
