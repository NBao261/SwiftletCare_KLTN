import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CpuIcon, TicketIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { HeartbeatTime, WifiSignal, nodeLocation } from '@/components/features/admin/devices/deviceColumns'
import CreateTicketModal from '@/components/features/admin/tickets/CreateTicketModal'
import { useFarm } from '@/hooks/shared/useFarms'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { useAllTickets } from '@/hooks/admin/useAdminTickets'
import { TICKET_TYPE_LABEL } from '@/constants/tickets'
import { t, translated } from '@/i18n'
import type { DeviceStatus, SystemNodeStatusItem, Ticket } from '@/types'

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

/** "112 Thiết bị mất kết nối\n6 Bảo trì định kỳ…" — đếm ticket theo loại, nhiều nhất trước (tooltip) */
function ticketBreakdown(tickets: Ticket[]) {
  const count = new Map<Ticket['type'], number>()
  for (const tk of tickets) count.set(tk.type, (count.get(tk.type) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1]).map(([type, n]) => `${n} ${TICKET_TYPE_LABEL[type]}`).join('\n')
}

const Muted = ({ children }: { children: ReactNode }) => <span className="font-normal text-warmGray">{children}</span>

/**
 * Drawer chi tiết thiết bị của Admin — khung giống drawer Farm Owner nhưng nội dung theo việc của Admin (giám sát
 * toàn hệ thống, SRS RACI "I (audit)" với thiết bị): thiết bị thuộc ai (farm + chủ để liên hệ), tình trạng kết nối
 * (mất kết nối bao lâu), và sự cố đang mở (cảnh báo của chính thiết bị, ticket của phòng) để quyết định có cần tạo
 * ticket không. Không hiện số đo môi trường — đó là việc vận hành của Farm Owner.
 */
export default function DeviceDetailDrawer({ node, onClose }: { node: SystemNodeStatusItem | null; onClose: () => void }) {
  const [creatingTicket, setCreatingTicket] = useState(false)
  const farmId = node?.farm_id || undefined
  const { data: farm } = useFarm(farmId)
  // Cảnh báo đang mở của phòng → lọc đúng thiết bị (alert.node_id = _id của node); 1 phòng ít cảnh báo nên 100 là đủ
  const alerts = useAlertsList({ farmId, zoneId: node?.zone_id, status: 'ACTIVE', limit: 100 })
  // Ticket của chính thiết bị: backend lọc theo nodeId qua cảnh báo (alert_id → alert.node_id); không gọi khi drawer đóng
  const { data: nodeTickets } = useAllTickets({ nodeId: node?._id }, { enabled: !!node })

  if (!node) return <Drawer open={false} onClose={onClose}>{null}</Drawer>

  const isSensor = node.type === 'sensor'
  const nodeAlerts = alerts.records.filter(a => a.node_id === node._id)
  const openTickets = (nodeTickets ?? []).filter(tk => tk.status !== 'CLOSED')
  const ticketListUrl = `/system/tickets?nodeId=${node._id}&device=${encodeURIComponent(node.device_id)}`
  // "Farm › Nhà yến › Tầng › Zone" — cùng các phần vị trí của bảng, ngăn bằng › kiểu đường dẫn
  const place = nodeLocation(node).replace(/ \| /g, ' › ')

  return (
    <>
      {/* Đang tạo ticket thì ẩn drawer (2 lớp phủ chồng nhau) — đóng popup là drawer hiện lại */}
      <Drawer open={!creatingTicket} onClose={onClose} title={t('Chi tiết thiết bị')}>
        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warmGray/10 text-charcoal">
                {isSensor ? <CpuIcon size={24} /> : <VideoCameraIcon size={24} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-h3 text-charcoal">{node.device_id}</p>
                <p className="truncate text-small text-warmGray">
                  {t(isSensor ? 'ESP32 · 5 cảm biến RS485' : 'Raspberry Pi · RTSP Stream')}
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
            <Row label="Ticket của thiết bị">
              {/* Ticket chưa đóng sinh từ cảnh báo của thiết bị này (rê chuột xem theo loại) → bảng Ticket lọc sẵn thiết bị;
                  đúng 1 ticket thì mở thẳng ticket đó. Ticket bảo trì/lắp đặt gắn phòng nên không tính */}
              {openTickets.length
                ? <Link
                    to={openTickets.length === 1 ? `/system/tickets/${openTickets[0]._id}` : ticketListUrl}
                    className="hover:underline"
                    title={ticketBreakdown(openTickets)}
                  >
                    {openTickets.length === 1
                      ? TICKET_TYPE_LABEL[openTickets[0].type]
                      : t('{{n}} ticket chưa đóng', { n: openTickets.length })}
                  </Link>
                : <Muted>{t('Không có')}</Muted>}
            </Row>
          </Section>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button className="w-full" onClick={() => setCreatingTicket(true)}>
            <TicketIcon size={16} />
            {t('Tạo ticket cho thiết bị')}
          </Button>
          <Button variant="secondary" className="w-full" onClick={onClose}>{t('Đóng')}</Button>
        </div>
      </Drawer>

      {/* Mở sẵn đúng farm + phòng của thiết bị */}
      <CreateTicketModal
        open={creatingTicket}
        onClose={() => setCreatingTicket(false)}
        defaultFarmId={farmId}
        defaultZoneId={node.zone_id}
      />
    </>
  )
}
