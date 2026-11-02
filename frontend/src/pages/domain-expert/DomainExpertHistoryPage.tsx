/**
 * DomainExpertHistoryPage — Lịch sử hoạt động chuyên gia
 *
 * SRS EXPERT-FR-009: Lịch sử các quyết định của Chuyên gia / Farm Owner (làm thay BR-22)
 * Đọc từ audit log qua GET /expert-activity?farmId=
 * Hỗ trợ lọc theo loại quyết định, theo nhà/vùng và phân trang chuẩn hệ thống.
 *
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useState } from 'react'
import {
  History,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  Activity,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import { useZoneStore } from '@/stores/zoneStore'
import { useExpertActivity } from '@/hooks/domain-expert/useExpertAlerts'
import type { ExpertActivityEntry } from '@/types/expert.types'
import { formatDate } from '@/lib/helpers'
import { cn } from '@/lib/cn'

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof Activity; badgeClass: string }
> = {
  ALERT_VERDICT_SET: {
    label: 'Thẩm định cảnh báo',
    icon: ShieldCheck,
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  THRESHOLD_UPDATED: {
    label: 'Ngưỡng vi khí hậu',
    icon: SlidersHorizontal,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  FUZZY_TUNING_UPDATED: {
    label: 'Hệ số điều khiển mờ',
    icon: SlidersHorizontal,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  DETECTION_TUNING_UPDATED: {
    label: 'Tham số phát hiện lỗi',
    icon: Activity,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  BIRD_COUNT_TUNING_UPDATED: {
    label: 'Sụt giảm đàn chim',
    icon: Activity,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  COUNTING_RING_UPDATED: {
    label: 'Vòng đếm camera',
    icon: Layers,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  HEALTH_REPORT_CONCLUDED: {
    label: 'Kết luận báo cáo',
    icon: FileText,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

const ACTION_OPTIONS: SelectMenuOption<string>[] = [
  { value: 'ALL', label: 'Tất cả hành động' },
  { value: 'ALERT_VERDICT_SET', label: 'Thẩm định cảnh báo' },
  { value: 'THRESHOLD_UPDATED', label: 'Ngưỡng vi khí hậu' },
  { value: 'FUZZY_TUNING_UPDATED', label: 'Hệ số điều khiển mờ' },
  { value: 'DETECTION_TUNING_UPDATED', label: 'Tham số phát hiện lỗi' },
  { value: 'BIRD_COUNT_TUNING_UPDATED', label: 'Sụt giảm đàn chim' },
  { value: 'COUNTING_RING_UPDATED', label: 'Vòng đếm camera' },
  { value: 'HEALTH_REPORT_CONCLUDED', label: 'Kết luận báo cáo' },
]

function renderActivityDetails(item: ExpertActivityEntry) {
  const m = item.metadata ?? {}

  if (item.action === 'ALERT_VERDICT_SET') {
    const isConfirmed = m.result === 'CONFIRMED'
    const note = m.note as string | undefined
    const alertType = m.type ? String(m.type) : undefined

    return (
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
              isConfirmed
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-neutral-100 text-warmGray border border-neutral-200',
            )}
          >
            {isConfirmed ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-red-500" />
                Xác nhận sự cố thật
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-warmGray" />
                Bác bỏ báo động giả (DISMISSED)
              </>
            )}
          </span>
          {alertType && <span className="font-semibold text-charcoal">{alertType}</span>}
        </div>
        {note && (
          <p className="text-warmGray italic bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100 mt-0.5">
            "{note}"
          </p>
        )}
      </div>
    )
  }

  if (item.action === 'HEALTH_REPORT_CONCLUDED') {
    const text = (m.text as string | undefined) ?? (m.conclusion as string | undefined)
    return (
      <div className="text-xs text-charcoal">
        <span className="font-semibold">Kết luận: </span>
        <span className="italic text-warmGray">"{text || 'Đã cập nhật kết luận chuyên gia'}"</span>
      </div>
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
        <div className="flex flex-wrap gap-1.5 text-xs">
          {changedKeys.map(k => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[11px]"
            >
              <strong className="text-charcoal font-mono">{k}:</strong>
              <span className="text-neutral-400 line-through">{String(before[k] ?? '—')}</span>
              <span className="text-charcoal font-semibold">→ {String(after[k] ?? '—')}</span>
            </span>
          ))}
        </div>
      )
    }
  }

  return (
    <span className="text-xs text-warmGray">
      Đã cập nhật thông số vận hành của trang trại
    </span>
  )
}

export default function DomainExpertHistoryPage() {
  const { selectedFarmId, selectedZoneId, selectedHouseId } = useZoneStore()
  const [actionType, setActionType] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading } = useExpertActivity({
    farmId: selectedFarmId ?? undefined,
    houseId: selectedHouseId ?? undefined,
    zoneId: selectedZoneId ?? undefined,
    type: actionType !== 'ALL' ? actionType : undefined,
    page,
    limit: pageSize,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const isFiltered = actionType !== 'ALL'

  return (
    <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-6">
      {/* Tiêu đề & Giới thiệu */}
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-charcoal flex items-center gap-2.5">
          <History className="h-7 w-7 text-graphite" />
          Lịch sử hoạt động chuyên môn
        </h1>
        <p className="text-sm text-warmGray">
          Nhật ký kiểm toán toàn bộ quyết định, phán quyết thẩm định và hiệu chỉnh tham số trên trang trại (EXPERT-FR-009).
        </p>
      </div>

      {/* Khung Card nội dung chính */}
      <Card size="lg" className="flex flex-col gap-4">
        {/* Bộ lọc và Tiêu đề danh sách */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-warmGray/10">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-charcoal shrink-0">Nhật ký quyết định</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-charcoal border border-warmGray/15">
              {total} bản ghi
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SelectMenu
              value={actionType}
              options={ACTION_OPTIONS}
              onChange={val => {
                setActionType(val)
                setPage(1)
              }}
              ariaLabel="Lọc theo loại hành động"
            />
            {isFiltered && (
              <ClearFiltersButton
                onClick={() => {
                  setActionType('ALL')
                  setPage(1)
                }}
              />
            )}
          </div>
        </div>

        {/* Nội dung danh sách */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            <LoadingSkeleton count={4} className="h-16 w-full rounded-xl" />
          </div>
        ) : !selectedFarmId ? (
          <div className="p-8">
            <EmptyState
              icon={<History className="w-8 h-8 text-warmGray" />}
              title="Chưa chọn trang trại"
              description="Vui lòng chọn trang trại ở thanh điều khiển phía trên để xem lịch sử hoạt động."
            />
          </div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<History className="w-8 h-8 text-warmGray" />}
              title="Không có bản ghi hoạt động nào"
              description={
                isFiltered
                  ? 'Không tìm thấy quyết định nào phù hợp với bộ lọc đã chọn.'
                  : 'Chưa có quyết định hoặc thay đổi tham số nào được ghi nhận cho trang trại này.'
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {records.map(item => {
              const cfg = ACTION_CONFIG[item.action] ?? {
                label: item.action,
                icon: Activity,
                badgeClass: 'bg-neutral-100 text-neutral-700 border-neutral-200',
              }
              const IconComp = cfg.icon
              const isOwner = item.actor_role === 'FARM_OWNER'
              const actorName = item.actor?.full_name || (isOwner ? 'Chủ nhà yến' : 'Chuyên gia')

              return (
                <div
                  key={item._id}
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-neutral-50/50 rounded-xl px-2 -mx-2"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5',
                        cfg.badgeClass,
                      )}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-charcoal">{cfg.label}</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border',
                            isOwner
                              ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                              : 'bg-[#ECFFA9]/60 text-charcoal border-[#B5D32C]/60',
                          )}
                        >
                          <UserCheck className="w-3 h-3" />
                          {actorName} ({isOwner ? 'Chủ nhà yến • BR-22' : 'Chuyên gia'})
                        </span>
                      </div>

                      {renderActivityDetails(item)}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto text-xs text-warmGray shrink-0 gap-1 pl-12 sm:pl-0">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.created_at)}
                    </span>
                    {(item.zone_id || item.house_id) && (
                      <span className="text-[11px] text-neutral-400">
                        {item.zone_id ? `Vùng: ${item.zone_id}` : `Nhà: ${item.house_id}`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Phân trang */}
        {total > pageSize && (
          <div className="pt-2 border-t border-warmGray/10">
            <Pagination
              page={page}
              limit={pageSize}
              total={total}
              onChange={setPage}
              variant="full"
            />
          </div>
        )}
      </Card>
    </div>
  )
}
