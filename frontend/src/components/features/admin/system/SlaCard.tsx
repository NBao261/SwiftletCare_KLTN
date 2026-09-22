import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSlaHours } from '@/hooks/admin/useSystem'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import { Button, Card } from '@/components/ui'
import { IconTicket, IconEdit } from '@/components/ui/icons'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { getApiErrorMessage } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { SLA_PRIORITIES, PRIORITY_LABEL, FACTORY_DEFAULT_SLA } from '@/constants/sla'
import { PRIORITY_ICON_CLASS } from './system.constants'
import SlaEditModal from './SlaEditModal'

/**
 * SLA xử lý ticket theo mức ưu tiên (TICKET-FR-006, SLA-NFR-001) — card lime bên
 * phải. Chỉ ĐỌC — bấm "Chỉnh sửa" mới mở SlaEditModal (popup trắng/đen).
 */
export default function SlaCard() {
  const { data, isLoading, error } = useSlaHours()
  const { data: kpi } = useTicketKpi()
  const [isEditing, setIsEditing] = useState(false)
  const isDefault = data && SLA_PRIORITIES.every(p =>
    data[p].response_hours === FACTORY_DEFAULT_SLA[p].response_hours
    && data[p].resolve_hours === FACTORY_DEFAULT_SLA[p].resolve_hours,
  )

  return (
    <>
      {/* variant="active" = bg-limeMist text-charcoal, đúng cặp màu pill nav active (SideBar.tsx).
          flex h-full: card giờ cao bằng hàng grid (auto-rows-fr) — 3 mức SLA canh giữa
          theo chiều dọc (flex-1 justify-center) và đổi thành khối rộng để lấp khoảng trống
          thay vì dồn lên đầu như danh sách gọn trước đây.
          shadow-card + hover:shadow-dock: gợi ý có thể tương tác dù chỉ nút Chỉnh sửa mới clickable. */}
      <Card variant="active" size="lg" className="flex h-full flex-col p-5 shadow-card transition-shadow duration-200 hover:shadow-dock">
        <div className="flex items-start justify-between gap-6">
          <div className="mt-2 flex min-w-0 items-center gap-2.5">
            <h2 className="font-bold text-charcoal">SLA xử lý ticket</h2>
            {data && (
              <span
                title={isDefault ? undefined : 'Khác với mặc định kỹ thuật gốc'}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  isDefault ? 'bg-charcoal/10 text-charcoal/70' : 'bg-charcoal text-white',
                )}
              >
                {isDefault ? 'Mặc định gốc' : 'Đã tuỳ chỉnh'}
              </span>
            )}
          </div>
          {data && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="shrink-0"
              aria-label="Chỉnh sửa cấu hình SLA xử lý ticket"
              onClick={() => setIsEditing(true)}
            >
              <IconEdit width={16} height={16} />
              Chỉnh sửa
            </Button>
          )}
        </div>
        <p className="mb-3 mt-1 text-sm text-charcoal/70">
          Hạn phản hồi/xử lý theo mức ưu tiên — áp dụng cho ticket tạo mới hoặc đổi ưu tiên sau khi lưu, không hồi tố ticket đang mở.
        </p>

        {isLoading && <LoadingSkeleton count={3} className="h-20 w-full bg-charcoal/10" />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-dashed border-charcoal/20 px-4 py-6 text-center text-sm text-charcoal/70">
            Không tải được cấu hình SLA — {getApiErrorMessage(error, 'thử tải lại trang.')}
          </p>
        )}

        {data && (
          <div className="flex flex-1 flex-col justify-center gap-3">
            {SLA_PRIORITIES.map(p => (
              <div key={p} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl bg-white px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', PRIORITY_ICON_CLASS[p])}>
                    <IconTicket width={16} height={16} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-charcoal">{PRIORITY_LABEL[p]}</span>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="label-caption text-charcoal/50">Phản hồi</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-charcoal">
                      {data[p].response_hours}<span className="ml-1 text-xs font-semibold text-charcoal/50">giờ</span>
                    </p>
                  </div>
                  <div>
                    <p className="label-caption text-charcoal/50">Xử lý</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-charcoal">
                      {data[p].resolve_hours}<span className="ml-1 text-xs font-semibold text-charcoal/50">giờ</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Snapshot lúc tải trang (GET /tickets/kpi) — null khi chưa ticket nào tới hạn. Tô đỏ khi tụt dưới 80% để thấy ngay cấu hình đang quá chặt so với thực tế xử lý */}
        {data && (
          <p className="mt-3 flex items-baseline justify-between gap-3 rounded-2xl bg-charcoal px-4 py-2.5 text-sm font-bold text-white">
            Tỉ lệ tuân thủ SLA hiện tại
            <span className={cn(
              'text-base font-bold tabular-nums',
              kpi?.slaComplianceRate == null ? 'text-white/40'
                : kpi.slaComplianceRate < 80 ? 'text-red-400' : 'text-limeMist',
            )}>
              {kpi?.slaComplianceRate != null ? `${kpi.slaComplianceRate}%` : '--'}
            </span>
          </p>
        )}

        {/* Audit log phân biệt 2 khối cấu hình bằng `action`, không phải target_id (backend log target_type='system_settings', target_id để trống) */}
        {data && !isDefault && (
          <Link
            to="/system/audit-log?action=SLA_UPDATED"
            className="mt-3 self-end text-xs font-semibold text-charcoal/60 underline underline-offset-2 hover:text-charcoal"
          >
            Xem lịch sử thay đổi
          </Link>
        )}
      </Card>

      <SlaEditModal open={isEditing} onClose={() => setIsEditing(false)} />
    </>
  )
}
