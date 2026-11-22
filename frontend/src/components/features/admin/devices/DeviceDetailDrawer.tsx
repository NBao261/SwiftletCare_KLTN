import { useState, type ReactNode } from 'react'
import { CpuIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { Badge, Button, ConfirmModal, type BadgeTone } from '@/components/ui'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import { Drawer } from '@/components/ui/Drawer'
import { HeartbeatTime, WifiSignal } from '@/components/features/admin/devices/deviceColumns'
import { nodeLocation } from '@/lib/deviceLocation'
import { useFarm } from '@/hooks/shared/useFarms'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { useSendNodeCommand } from '@/hooks/shared/useDevices'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t, translated } from '@/i18n'
import type { DeviceStatus, NodeCommandInput, SystemNodeStatusItem } from '@/types'

const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
  ONLINE: 'positive', OFFLINE: 'neutral', PENDING: 'warning', // ERROR/DEGRADED đã bỏ
}
const STATUS_LABEL: Record<DeviceStatus, string> = translated({
  ONLINE: 'Online', OFFLINE: 'Mất kết nối', PENDING: 'Chờ kết nối', // ERROR/DEGRADED đã bỏ
})

const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

// Nhóm thông tin: tiêu đề nhỏ + các dòng nhãn trái / giá trị phải, kẻ vạch giữa dòng
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-body font-bold text-charcoal">{t(title)}</h3>
      <dl className="mt-1 divide-y divide-warmGray/10 border-y border-warmGray/10">{children}</dl>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-small">
      <dt className="shrink-0 text-warmGray">{t(label)}</dt>
      <dd className="min-w-0 text-right font-semibold text-charcoal">{children}</dd>
    </div>
  )
}

const Muted = ({ children }: { children: ReactNode }) => <span className="font-normal text-warmGray">{children}</span>

// Chi tiết thiết bị của Admin: chủ farm, kết nối, cảnh báo đang mở; Khởi động lại, Đẩy cấu hình; không số đo môi trường
export default function DeviceDetailDrawer({ node, onClose }: { node: SystemNodeStatusItem | null; onClose: () => void }) {
  const farmId = node?.farm_id || undefined
  const { data: farm } = useFarm(farmId)
  // Cảnh báo đang mở của phòng → lọc đúng thiết bị (alert.node_id = _id của node); 1 phòng ít cảnh báo nên 100 là đủ Chỉ gọi khi drawer đang mở (node có giá trị): đóng drawer không tải cảnh báo
  const alerts = useAlertsList({ farmId, zoneId: node?.zone_id, status: 'ACTIVE', limit: 100 }, { enabled: !!node })
  const sendCommand = useSendNodeCommand()
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(state => state.push)
  const [confirmRestart, setConfirmRestart] = useState(false)

  // lệnh từ xa; firmware trước 1.4.0 trả 501 (không hỗ trợ RESTART)
  function send(command: NodeCommandInput['command'], doneText: string): void {
    if (!node) return
    sendCommand.mutate({ nodeId: node._id, input: { command } }, {
      onSuccess: () => push(t(doneText, { device: node.device_id })),
      onError: error => push(
        (error as { response?: { status?: number } }).response?.status === 501 ? t('Firmware chưa hỗ trợ lệnh này') : apiErrorMessage(error),
        'error',
      ),
      onSettled: () => setConfirmRestart(false),
    })
  }

  if (!node) return <Drawer open={false} onClose={onClose}>{null}</Drawer>

  const isSensor = node.type === 'sensor'
  const isOnline = node.status === 'ONLINE'
  const nodeAlerts = alerts.records.filter(a => a.node_id === node._id)
  // "Farm › Nhà yến › Tầng › Zone": cùng các phần vị trí của bảng, ngăn bằng › kiểu đường dẫn
  const place = nodeLocation(node).replace(/ \| /g, ' › ')

  return (
    <Drawer open onClose={onClose} title={t('Chi tiết thiết bị')}>
      <div className="-mx-6 flex-1 overflow-y-auto px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warmGray/10 text-charcoal">
              {isSensor ? <CpuIcon size={24} /> : <VideoCameraIcon size={24} />}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-h3 text-charcoal">{node.device_id}</p>
                <SimulatedBadge simulated={node.simulated} />
              </div>
              <p className="truncate text-small text-warmGray">
                {/* camera là camera IP phát RTSP, AI đếm chim chạy trên AI node (PC) */}
                {t(isSensor ? '5 cảm biến' : 'Camera IP · RTSP Stream')}
              </p>
            </div>
          </div>
          <Badge tone={STATUS_TONE[node.status]}>{STATUS_LABEL[node.status]}</Badge>
        </div>

        <Section title="Thông tin">
          <Row label="Trang trại">{node.farm_name || '—'}</Row>
          {/* 1 dòng, giá trị 2 tầng: tên đậm trên, email xám dưới */}
          <Row label="Chủ nhà yến">
            {farm?.owner?.full_name ? (
              <span className="flex flex-col">
                <span className="truncate">{farm.owner.full_name}</span>
                {farm.owner.email && <span className="truncate font-normal text-warmGray" title={farm.owner.email}>{farm.owner.email}</span>}
              </span>
            ) : <Muted>—</Muted>}
          </Row>
          <Row label="Vị trí lắp">{place || <Muted>—</Muted>}</Row>
        </Section>

        <Section title="Kết nối">
          {/* 2 dòng giờ:phút:giây (đậm) / ngày (chữ thường, không xám) */}
          <Row label="Lần kết nối cuối"><HeartbeatTime at={node.last_heartbeat} plainDate /></Row>
          <Row label="Wi-Fi"><WifiSignal node={node} /></Row>
          <Row label="Firmware">{node.firmware_version ? `v${node.firmware_version}` : <Muted>—</Muted>}</Row>
          <Row label="Ngày kích hoạt">{node.registered_at ? DAY.format(new Date(node.registered_at)) : <Muted>—</Muted>}</Row>
        </Section>

        <Section title="Sự cố">
          <Row label="Cảnh báo của thiết bị">
            {nodeAlerts.length
              ? <span className="text-climateOrange" title={nodeAlerts.map(a => a.title).join('\n')}>
                  {nodeAlerts[0].title}{nodeAlerts.length > 1 && ` +${nodeAlerts.length - 1}`}
                </span>
              : <Muted>{t('Không có')}</Muted>}
          </Row>
        </Section>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        {isSensor && (
          <>
            {/* Lệnh từ xa chỉ tới được thiết bị ONLINE (backend 409) */}
            {!isOnline && <p className="text-small text-warmGray">{t('Lệnh từ xa chỉ gửi được khi thiết bị đang online.')}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={!isOnline} loading={sendCommand.isPending} onClick={() => send('PUSH_CONFIG', 'Đã gửi cấu hình tới {{device}}')}>
                {t('Đẩy cấu hình')}
              </Button>
              <Button variant="secondary" disabled={!isOnline || sendCommand.isPending} onClick={() => setConfirmRestart(true)}>{t('Khởi động lại')}</Button>
            </div>
          </>
        )}
        <Button variant="secondary" className="w-full" onClick={onClose}>{t('Đóng')}</Button>
      </div>
      <ConfirmModal
        open={confirmRestart}
        title={t('Khởi động lại')}
        description={t('Bộ điều khiển {{device}} khởi động lại và chạy tiếp với cấu hình đã lưu; Chủ nhà yến được báo trong ứng dụng.', { device: node.device_id })}
        confirmLabel={t('Khởi động lại')}
        loading={sendCommand.isPending}
        onConfirm={() => send('RESTART', 'Đã gửi lệnh khởi động lại tới {{device}}')}
        onCancel={() => setConfirmRestart(false)}
      />
    </Drawer>
  )
}
