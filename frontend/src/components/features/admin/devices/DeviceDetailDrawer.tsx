import type { ReactNode } from 'react'
import { CpuIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { HeartbeatTime, WifiSignal, nodeLocation } from '@/components/features/admin/devices/deviceColumns'
import { useFarm } from '@/hooks/shared/useFarms'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { t, translated } from '@/i18n'
import type { DeviceStatus, SystemNodeStatusItem } from '@/types'

const STATUS_TONE: Record<DeviceStatus, BadgeTone> = {
  ONLINE: 'positive', OFFLINE: 'neutral', ERROR: 'critical', DEGRADED: 'warning', PENDING: 'warning',
}
const STATUS_LABEL: Record<DeviceStatus, string> = translated({
  ONLINE: 'Online', OFFLINE: 'Offline', ERROR: 'Lỗi', DEGRADED: 'Suy giảm', PENDING: 'Chờ kết nối',
})

const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

/** Nhóm thông tin: tiêu đề nhỏ + các dòng nhãn trái / giá trị phải, kẻ vạch giữa dòng */
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

/**
 * Drawer chi tiết thiết bị của Admin — khung giống drawer Farm Owner nhưng nội dung theo việc của Admin (giám sát
 * toàn hệ thống, SRS RACI "I (audit)" với thiết bị): thiết bị thuộc ai (farm + chủ để liên hệ), tình trạng kết nối
 * (mất kết nối bao lâu) và cảnh báo đang mở của chính thiết bị. Không hiện số đo môi trường — đó là việc vận hành
 * của Farm Owner.
 */
export default function DeviceDetailDrawer({ node, onClose }: { node: SystemNodeStatusItem | null; onClose: () => void }) {
  const farmId = node?.farm_id || undefined
  const { data: farm } = useFarm(farmId)
  // Cảnh báo đang mở của phòng → lọc đúng thiết bị (alert.node_id = _id của node); 1 phòng ít cảnh báo nên 100 là đủ
  // Chỉ gọi khi drawer đang mở (node có giá trị) — đóng drawer không tải cảnh báo
  const alerts = useAlertsList({ farmId, zoneId: node?.zone_id, status: 'ACTIVE', limit: 100 }, { enabled: !!node })

  if (!node) return <Drawer open={false} onClose={onClose}>{null}</Drawer>

  const isSensor = node.type === 'sensor'
  const nodeAlerts = alerts.records.filter(a => a.node_id === node._id)
  // "Farm › Nhà yến › Tầng › Zone" — cùng các phần vị trí của bảng, ngăn bằng › kiểu đường dẫn
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
              <p className="truncate text-h3 text-charcoal">{node.device_id}</p>
              <p className="truncate text-small text-warmGray">
                {/* SRS v2.0.0: camera là camera IP phát RTSP, AI đếm chim chạy trên nút PC/cloud — không còn Raspberry Pi */}
                {t(isSensor ? 'ESP32 · 5 cảm biến RS485' : 'Camera IP · RTSP Stream')}
              </p>
            </div>
          </div>
          <Badge tone={STATUS_TONE[node.status]}>{STATUS_LABEL[node.status]}</Badge>
        </div>

        <Section title="Thông tin">
          <Row label="Trang trại">{node.farm_name || '—'}</Row>
          {/* 1 dòng, giá trị 2 tầng: tên đậm trên, email xám dưới */}
          <Row label="Chủ trang trại">
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
          <Row label="Heartbeat gần nhất"><HeartbeatTime at={node.last_heartbeat} plainDate /></Row>
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
        <Button variant="secondary" className="w-full" onClick={onClose}>{t('Đóng')}</Button>
      </div>
    </Drawer>
  )
}
