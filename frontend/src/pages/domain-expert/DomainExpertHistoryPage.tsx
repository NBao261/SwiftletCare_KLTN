// Lịch sử quyết định của chuyên gia, hoặc Farm Owner làm thay
import { useMemo, useState } from 'react'
import { Badge, DataTable, SectionCard, type DataTableColumn } from '@/components/ui'
import { formatParamValue } from '@/components/features/domain-expert/reviews/ParameterReviewCard'
import { ringList } from '@/components/common/countingRing.utils'
import { NO_VALUE } from '@/constants/display'
import { THRESHOLD_FIELDS } from '@/constants/thresholds'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import { useZoneStore } from '@/stores/zoneStore'
import { alertTypeDict } from '@/constants/enumLabels.i18n'
import { useAllZones, useHouses } from '@/hooks/shared/useFarms'
import { useExpertActivity } from '@/hooks/domain-expert/useExpertAlerts'
import type { AlertType } from '@/types'
import type { CountingSchedule, ExpertActivityEntry } from '@/types/expert.types'
import { formatHourMinute, formatStandardDate } from '@/lib/i18n'
import { t, translated } from '@/i18n'
import { useLanguageStore } from '@/stores/languageStore'

const ACTION_OPTIONS: SelectMenuOption<string>[] = [
  { value: 'ALL', label: 'Tất cả hành động' },
  { value: 'ALERT_VERDICT_SET', label: 'Kiểm chứng cảnh báo' },
  { value: 'THRESHOLD_UPDATED', label: 'Ngưỡng vi khí hậu' },
  { value: 'FUZZY_TUNING_UPDATED', label: 'Hệ số điều khiển mờ' },
  { value: 'DETECTION_TUNING_UPDATED', label: 'Tham số phát hiện lỗi' },
  { value: 'BIRD_COUNT_TUNING_UPDATED', label: 'Sụt giảm đàn chim' },
  { value: 'COUNTING_RING_UPDATED', label: 'Vòng đếm camera' },
  { value: 'COUNTING_SCHEDULE_UPDATED', label: 'Lịch đếm chim' },
  { value: 'HEALTH_REPORT_CONCLUDED', label: 'Kết luận báo cáo' },
  { value: 'HEALTH_LEVELS_UPDATED', label: 'Mức chỉ số sức khoẻ' },
  { value: 'WEATHER_RULES_UPDATED', label: 'Luật bù thời tiết' },
  { value: 'REVIEW_ACCEPTED', label: 'Chấp nhận thay đổi của Chủ nhà yến' },
  { value: 'REVIEW_REVERTED', label: 'Hoàn lại thay đổi của Chủ nhà yến' },
  { value: 'PROPOSAL_APPROVED', label: 'Duyệt đề xuất hệ số mờ' },
  { value: 'PROPOSAL_REJECTED', label: 'Từ chối đề xuất hệ số mờ' },
  { value: 'CONFIG_PROFILE_APPROVED', label: 'Duyệt hồ sơ cấu hình' },
]
// Tên loại quyết định lấy từ chính danh sách của ô lọc
const ACTION_LABELS = new Map(ACTION_OPTIONS.map(option => [option.value, option.label]))

// Tham số chưa có nhãn hiện "Tham số khác"
const FIELD_LABELS: Record<string, string> = translated({
  ...Object.fromEntries(THRESHOLD_FIELDS.map(field => [field.key, field.label])),
  fuzzy_humidity_band: 'Dải chuyển độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải chuyển nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt khi khô (%)',
  fuzzy_window_sec: 'Cửa sổ lọc (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến',
  noise_margin_db: 'Biên độ ồn vượt nền (dB)',
  noise_min_sec: 'Thời gian ồn tối thiểu (giây)',
  pump_dry_on_sec: 'Thời gian bơm chạy không tăng ẩm (giây)',
  pump_dry_min_rise_pct: 'Độ ẩm cần tăng tối thiểu (%)',
  speaker_drop_pct: 'Độ sụt âm lượng báo hỏng loa (%)',
  return_rate_drop_pct: 'Mức giảm tỷ lệ chim về (%)',
  in_range_slight_pct: 'Môi trường lệch nhẹ',
  in_range_clear_pct: 'Môi trường lệch rõ',
  air_slight_h: 'Không khí lệch nhẹ',
  air_clear_h: 'Không khí lệch rõ',
  noise_slight: 'Tiếng ồn lệch nhẹ',
  noise_clear: 'Tiếng ồn lệch rõ',
  ring: 'Vòng đếm',
  rings: 'Vòng đếm',
  profiles: 'Hồ sơ theo mùa',
  temporary: 'Khung tạm',
  default_windows: 'Khung mặc định của nhà',
})

// Khoá có cấu trúc lồng nhau: tóm tắt như ở trang Duyệt thay đổi (vòng đếm, khung giờ) thay vì "đã đổi"
const STRUCTURED_KEYS = new Set(['ring', 'rings', 'default_windows'])

// Object không in thẳng để tránh "[object Object]"
function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return t('{{n}} mục', { n: value.length })
  if (typeof value === 'object') return t('đã đổi')
  return String(value)
}

// Danh sách vòng của một bên "trước/sau": bản mới ghi danh sách, bản cũ ghi một vòng hoặc bọc trong { rings } / { ring }
function ringsOf(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const wrapped = value as { rings?: unknown; ring?: unknown }
    if ('rings' in wrapped) return ringList(wrapped.rings)
    if ('ring' in wrapped) return ringList(wrapped.ring)
  }
  return ringList(value)
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY', 'MM-DD' → 'DD/MM'
const dayText = (value: string) => value.split('-').reverse().join('/')

// một lần sửa lịch đếm: ngày áp và từng hồ sơ, khung tạm của lịch mới
function renderCountingSchedule(metadata: Record<string, unknown>) {
  const schedule = metadata.after as CountingSchedule | undefined
  // Gọn: ngày dạng ngày/tháng, khung một ngày ghi một ngày; giờ hai phiên xem khi rê chuột
  const shortDay = (value: string) => dayText(value.slice(-5))
  const span = (from: string, to: string) => (from === to ? shortDay(from) : `${shortDay(from)}–${shortDay(to)}`)
  const hours = (windows: { morning: { start: string; end: string }; evening: { start: string; end: string } }) =>
    t('Sáng {{morning}}, chiều {{evening}}', { morning: `${windows.morning.start}–${windows.morning.end}`, evening: `${windows.evening.start}–${windows.evening.end}` })
  const profiles = schedule?.profiles ?? []
  const temporary = schedule?.temporary ?? []
  return (
    <ul className="flex flex-col gap-0.5 text-sm text-charcoal">
      {temporary.map(window => (
        <li key={`temporary-${window.from}`} title={hours(window)}>{t('Khung tạm {{span}}', { span: span(window.from, window.to) })}</li>
      ))}
      {profiles.map(profile => (
        <li key={`profile-${profile.name}-${profile.from}`} title={hours(profile)}>{t('Hồ sơ {{name}} {{span}}', { name: profile.name, span: span(profile.from, profile.to) })}</li>
      ))}
      {profiles.length === 0 && temporary.length === 0 && <li className="text-warmGray">{t('Khung mặc định')}</li>}
    </ul>
  )
}

function renderActivityDetails(item: ExpertActivityEntry) {
  const m = item.metadata ?? {}

  if (item.action === 'ALERT_VERDICT_SET') {
    const isConfirmed = m.result === 'CONFIRMED'
    const note = m.note as string | undefined
    const alertType = m.type ? alertTypeDict[useLanguageStore.getState().lang][m.type as AlertType] ?? t('Cảnh báo khác') : undefined

    return (
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isConfirmed ? 'critical' : 'neutral'}>{isConfirmed ? t('Xác nhận sự cố thật') : t('Bác bỏ báo động giả')}</Badge>
          {alertType && <span className="font-semibold text-charcoal">{alertType}</span>}
        </div>
        {note && (
          <p className="italic text-warmGray">"{note}"</p>
        )}
      </div>
    )
  }

  if (item.action === 'HEALTH_REPORT_CONCLUDED') {
    const text = (m.text as string | undefined) ?? (m.conclusion as string | undefined)
    return (
      <div className="text-xs text-charcoal">
        <span className="font-semibold">{t('Kết luận:')} </span>
        <span className="italic text-warmGray">"{text || t('Đã cập nhật kết luận chuyên gia')}"</span>
      </div>
    )
  }

  if (item.action === 'COUNTING_SCHEDULE_UPDATED') return renderCountingSchedule(m)

  // Vòng đếm: chỉ ghi số vòng trước và sau (chi tiết đỉnh xem ở trang Vòng đếm)
  if (item.action === 'COUNTING_RING_UPDATED') {
    const before = formatParamValue(ringsOf(m.before), 'rings')
    const after = formatParamValue(ringsOf(m.after), 'rings')
    return (
      <p className="text-xs text-charcoal">
        <span className="text-graphite">{t('Vòng đếm')}: </span>
        <span className="font-semibold">{before === after ? after : `${before} → ${after}`}</span>
      </p>
    )
  }

  // Before / After changes
  if (m.before || m.after) {
    const before = (m.before ?? {}) as Record<string, unknown>
    const after = (m.after ?? {}) as Record<string, unknown>
    const changedKeys = Object.keys(after).filter(
      k => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    )

    if (changedKeys.length > 0) {
      return (
        <ul className="flex flex-col gap-0.5 text-xs">
          {changedKeys.map(k => {
            const oldText = STRUCTURED_KEYS.has(k) && before[k] !== undefined ? formatParamValue(before[k], k) : formatChangeValue(before[k])
            const newText = STRUCTURED_KEYS.has(k) ? formatParamValue(after[k], k) : formatChangeValue(after[k])
            // Chưa có giá trị cũ: chỉ ghi giá trị mới; có thì "cũ → mới" trên một dòng
            return (
              <li key={k} className="text-charcoal">
                <span className="text-graphite">{FIELD_LABELS[k] ?? t('Tham số khác')}: </span>
                <span className="whitespace-nowrap font-semibold">{oldText === '—' ? newText : `${oldText} → ${newText}`}</span>
              </li>
            )
          })}
        </ul>
      )
    }
  }

  return (
    <span className="text-xs text-warmGray">
      {t('Đã cập nhật thông số vận hành của trang trại')}
    </span>
  )
}

export default function DomainExpertHistoryPage() {
  const { selectedFarmId, selectedHouseId } = useZoneStore()
  // Tra tên nhà và tên Zone để không hiện id nội bộ (FE_Design 13.16)
  const { data: houses = [] } = useHouses(selectedFarmId ?? undefined)
  const { data: allZones = [] } = useAllZones()
  const houseNames = useMemo(() => new Map(houses.map(house => [house._id, house.name])), [houses])
  const zoneNames = useMemo(() => new Map(allZones.map(zone => [zone._id, `${zone.houseName} · ${zone.name}`])), [allZones])
  const [actionType, setActionType] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading } = useExpertActivity({
    farmId: selectedFarmId ?? undefined,
    // Lọc tới nhà vì quyết định cấp nhà không có zone_id
    houseId: selectedHouseId || undefined,
    type: actionType !== 'ALL' ? actionType : undefined,
    page,
    limit: pageSize,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const isFiltered = actionType !== 'ALL'

  const columns: DataTableColumn<ExpertActivityEntry>[] = [
    {
      key: 'action',
      header: 'Quyết định',
      className: 'w-52',
      render: item => <span className="text-sm font-semibold text-charcoal">{t(ACTION_LABELS.get(item.action) ?? 'Quyết định khác')}</span>,
    },
    {
      key: 'time',
      header: 'Thời gian',
      className: 'w-32 whitespace-nowrap',
      // Hai dòng: giờ phía trên, ngày xám phía dưới
      render: item => (
        <div className="flex flex-col tabular-nums">
          <span className="text-sm text-charcoal">{formatHourMinute(item.created_at)}</span>
          <span className="text-xs text-warmGray">{formatStandardDate(item.created_at)}</span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Người quyết định',
      className: 'w-64',
      render: item => {
        const isOwner = item.actor_role === 'FARM_OWNER'
        return (
          <div className="flex flex-col">
            <span className="text-sm text-charcoal">{item.actor?.full_name || (isOwner ? t('Chủ nhà yến') : t('Chuyên gia'))}</span>
            <span className="text-xs text-warmGray">{isOwner ? t('Chủ nhà yến · thay chuyên gia') : t('Chuyên gia')}</span>
          </div>
        )
      },
    },
    { key: 'details', header: 'Nội dung', render: item => renderActivityDetails(item) },
    {
      key: 'place',
      header: 'Vị trí',
      className: 'w-44',
      render: item => {
        const place = (item.zone_id && zoneNames.get(item.zone_id)) || (item.house_id && houseNames.get(item.house_id))
        return <span className="text-sm text-charcoal">{place || NO_VALUE}</span>
      },
    },
  ]

  // Chưa chọn trại → nhắc chọn; tải → khung chờ; rỗng → khung rỗng; còn lại là bảng và phân trang
  let body = (
    <p className="py-6 text-center text-sm text-warmGray">{t('Chọn trang trại ở thanh trên.')}</p>
  )
  if (selectedFarmId && isLoading) body = <LoadingSkeleton count={4} className="h-14 w-full rounded-xl" />
  if (selectedFarmId && !isLoading && records.length === 0) {
    body = (
      <p className="py-6 text-center text-sm text-warmGray">
        {isFiltered ? t('Không có bản ghi nào khớp bộ lọc.') : t('Chưa có bản ghi hoạt động nào.')}
      </p>
    )
  }
  if (selectedFarmId && !isLoading && records.length > 0) {
    body = (
      <>
        <DataTable columns={columns} rows={records} getRowKey={item => item._id} minTableWidth={1000} />
        <Pagination page={page} limit={pageSize} total={total} onChange={setPage} variant="full" />
      </>
    )
  }

  return (
    <SectionCard description={t('{{n}} bản ghi', { n: total })}>
      {/* Ô lọc bên trái, danh sách mở sang phải không bị mép trang che */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SelectMenu
          value={actionType}
          options={ACTION_OPTIONS}
          onChange={value => {
            setActionType(value)
            setPage(1)
          }}
          ariaLabel={t('Lọc theo loại hành động')}
        />
      </div>
      {body}
    </SectionCard>
  )
}
