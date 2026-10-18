import { useEffect, useRef } from 'react'
import { PlusIcon, WarningIcon } from '@phosphor-icons/react'
import SeverityBadge from '@/components/common/SeverityBadge'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { supportDict } from '@/constants/support.i18n'
import { cn } from '@/lib/cn'
import { levelDict } from '@/constants/severity.i18n'
import { LEVELS } from '@/constants/severity'
import PriorityBadge from '@/components/common/PriorityBadge'
import type { Alert, TicketPriority } from '@/types'
import type { DeviceFaultRow } from '@/hooks/farm-owner/useDeviceFaultAlerts'

// Số dòng tối đa hiện cùng lúc, nhiều hơn thì cuộn trong khung
const VISIBLE_ROWS = 5
// Nút cuối dòng: rộng, cao cố định theo chữ dài nhất cả VI/EN ("+ Create ticket"), rê chuột nền đen chữ trắng như nút hành động ở Cấu trúc Farm
const ROW_ACTION_CLASS =
  'inline-flex h-8 w-36 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white sm:self-auto'
// Badge mức độ đầu dòng: rộng cố định cho cả VI/EN để cột chữ phía sau thẳng hàng
const SEVERITY_CELL_CLASS = 'w-[88px] shrink-0 justify-center'
// Ô đếm theo cấp ở header: rộng cố định cho cả VI/EN ("Khẩn cấp · 12")
const COUNT_CHIP_CLASS = 'w-[104px] justify-center'
// Mô tả header: luôn giữ chỗ 2 dòng, dài hơn thì cắt — chiều cao khung không đổi khi đổi ngôn ngữ
const DESCRIPTION_CLASS = 'mt-0.5 line-clamp-2 min-h-10 text-sm leading-5 text-graphite'

interface DeviceFaultAlertPanelProps {
  rows: DeviceFaultRow[]
  byLevel: Record<TicketPriority, number>
  // Tên farm, chưa tra được thì trả undefined
  farmName: (farmId: string) => string | undefined
  zoneLabel: (zoneId?: string) => string | undefined
  // Tạo yêu cầu kèm tiêu đề và mô tả cảnh báo đang hiện
  onCreateTicket: (alert: Alert, summary: string) => void
}

// Giới hạn chiều cao khung theo số dòng hiện cùng lúc
function useVisibleRowsLimit(rowCount: number) {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const apply = () => {
      const last = list.children[VISIBLE_ROWS - 1] as HTMLElement | undefined
      // ul là `relative` nên offsetTop của dòng tính từ mép trên danh sách
      list.style.maxHeight = rowCount > VISIBLE_ROWS && last ? `${last.offsetTop + last.offsetHeight}px` : ''
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(list)
    return () => observer.disconnect()
  }, [rowCount])

  return listRef
}

// Khung báo lỗi thiết bị: chỉ cảnh báo đang mở chưa có ticket, mỗi dòng có nút tạo ticket điền sẵn; có ticket rồi thì dòng tự ẩn
export default function DeviceFaultAlertPanel({ rows, byLevel, farmName, zoneLabel, onCreateTicket }: DeviceFaultAlertPanelProps) {
  // dashboardDict: tên loại cảnh báo (alertType.*) dùng chung với Nhật ký cảnh báo ở Dashboard
  const { t: tAlert } = useTranslation(dashboardDict)
  const { t, ago } = useTranslation(supportDict)
  // Nhãn mức trong câu mô tả lấy từ bảng chung — trùng chữ trên badge
  const { t: tLevel } = useTranslation(levelDict)
  const listRef = useVisibleRowsLimit(rows.length)
  if (rows.length === 0) return null
  const scrollable = rows.length > VISIBLE_ROWS

  return (
    // Khung cảnh báo nền cam rất nhạt (orange-50, nhạt hơn badge Cao orange-100), dòng bên trong nền trắng để badge mức độ nổi rõ
    <section aria-label={t('fault.aria')} className="flex flex-col gap-4 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4">
      {/* Header khung báo lỗi: chữ bên trái co giãn, ô đếm bên phải cố định — đổi VI/EN không nhảy */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <WarningIcon size={22} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-h3 font-bold text-charcoal">{t('fault.title', { n: rows.length })}</h2>
            <p className={DESCRIPTION_CLASS}>{t('fault.desc', { urgent: tLevel('P1') })}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {LEVELS.filter(level => byLevel[level] > 0).map(level => (
            <PriorityBadge key={level} priority={level} count={byLevel[level]} className={COUNT_CHIP_CLASS} />
          ))}
        </div>
      </div>

      {/* pr-1: chừa chỗ thanh cuộn khi > 5 dòng, không đè lên nút bên phải */}
      <ul ref={listRef} className={cn('relative flex flex-col gap-2', scrollable && 'overflow-y-auto pr-1')}>
        {rows.map(({ alert, deviceName }) => {
          // Tiêu đề dựng lại theo loại + mã thiết bị và ngôn ngữ đang chọn, không dùng câu thô của backend
          const type = tAlert(`alertType.${alert.type}`)
          const title = deviceName ? t('fault.titleDevice', { type, device: deviceName }) : type
          const detail = t(`faultDesc.${alert.type}`)
          const farm = farmName(alert.farm_id)
          const zone = zoneLabel(alert.zone_id)
          const location = farm && zone ? `${farm} · ${zone}` : t('cell.unknownLocation')
          return (
            <li key={alert._id} className="flex shrink-0 flex-col gap-3 rounded-xl border border-orange-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
              <SeverityBadge severity={alert.severity} className={SEVERITY_CELL_CLASS} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-charcoal">{title}</p>
                <p className="truncate text-xs text-warmGray">{location} · {ago(alert.created_at)} · {detail}</p>
              </div>
              <button type="button" className={ROW_ACTION_CLASS} onClick={() => onCreateTicket(alert, `${title} — ${detail}`)}>
                <PlusIcon size={12} weight="bold" />
                {t('fault.create')}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
