import { useState } from 'react'
import { ClockIcon, TimerIcon } from '@phosphor-icons/react'
import { useSlaHours } from '@/hooks/admin/useSystem'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { getApiErrorMessage } from '@/lib/helpers'
import { t } from '@/i18n'
import { SLA_PRIORITIES, PRIORITY_LABEL, FACTORY_DEFAULT_SLA } from '@/constants/sla'
import SettingsCardHeader from '@/components/features/admin/system/SettingsCardHeader'
import SlaEditModal from '@/components/features/admin/system/SlaEditModal'

const ICON = 'bg-warmGray/10 text-charcoal'
/** Cùng ngưỡng cảnh báo với ô "Đúng hạn SLA" trang Ticket (TicketInsights SLA_WARN_RATE) */
const SLA_WARN_RATE = 80

/**
 * SLA xử lý ticket theo mức ưu tiên (TICKET-FR-006, SLA-NFR-001). Cùng kiểu card "Chỉ số vận hành toàn hệ thống":
 * card trắng + 3 ô mức ưu tiên (số lớn = hạn xử lý, dòng phụ = hạn phản hồi) + 1 ô tỉ lệ tuân thủ hiện tại
 * (snapshot GET /tickets/kpi, ghi rõ dưới/đạt mục tiêu bằng chữ, không tô đỏ). Chỉ ĐỌC — "Chỉnh sửa" mở SlaEditModal.
 */
export default function SlaCard() {
  const { data, isLoading, error } = useSlaHours()
  const { data: kpi } = useTicketKpi()
  const [isEditing, setIsEditing] = useState(false)
  const isDefault = data
    ? SLA_PRIORITIES.every(p =>
      data[p].response_hours === FACTORY_DEFAULT_SLA[p].response_hours
      && data[p].resolve_hours === FACTORY_DEFAULT_SLA[p].resolve_hours)
    : undefined
  const rate = kpi?.slaComplianceRate ?? null

  return (
    <>
      <Card className="flex flex-col gap-4">
        <SettingsCardHeader
          title="SLA xử lý ticket"
          description="Hạn phản hồi và xử lý theo mức ưu tiên — áp dụng cho ticket tạo mới hoặc đổi ưu tiên sau khi lưu."
          isDefault={isDefault}
          onEdit={() => setIsEditing(true)}
          editLabel="Chỉnh sửa cấu hình SLA xử lý ticket"
        />

        {isLoading && <LoadingSkeleton count={1} className="h-24 w-full" />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-sm text-warmGray">
            {t('Không tải được cấu hình SLA')} — {t(getApiErrorMessage(error, 'thử tải lại trang.'))}
          </p>
        )}

        {data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {SLA_PRIORITIES.map(p => (
              <StatTile
                key={p}
                className="shadow-none"
                icon={ClockIcon}
                iconClass={ICON}
                label={`${p} · ${PRIORITY_LABEL[p]}`}
                value={t('{{h}} giờ', { h: data[p].resolve_hours })}
                sub={t('Xử lý xong · phản hồi trong {{h}} giờ', { h: data[p].response_hours })}
              />
            ))}
            <StatTile
              className="shadow-none"
              icon={TimerIcon}
              iconClass={ICON}
              label="Tuân thủ SLA hiện tại"
              value={rate != null ? `${rate}%` : '--'}
              sub={rate != null ? t(rate < SLA_WARN_RATE ? 'Dưới mục tiêu {{n}}%' : 'Đạt mục tiêu {{n}}%', { n: SLA_WARN_RATE }) : 'Chưa có ticket nào tới hạn'}
            />
          </div>
        )}
      </Card>

      <SlaEditModal open={isEditing} onClose={() => setIsEditing(false)} />
    </>
  )
}
