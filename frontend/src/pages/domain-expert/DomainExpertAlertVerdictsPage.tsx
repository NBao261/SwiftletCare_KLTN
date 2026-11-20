/**
 * DomainExpertAlertVerdictsPage — Thẩm định Cảnh báo Suy luận
 *
 * Rename + re-bucket từ ExpertAuditLogsPage:
 *   Cũ: pages/expert/ExpertAuditLogsPage.tsx  →  expert/audit-logs
 *   Mới: pages/domain-expert/DomainExpertAlertVerdictsPage.tsx  →  domain-expert/alert-verdicts
 *
 * SRS EXPERT-FR-003, ENV-FR-019.
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Info, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import SelectMenu from '@/components/ui/SelectMenu'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import AlertsKpiAndStatsBar, {
  TYPE_OPTS,
  INFERRED_SEVERITIES,
  TAB_INFO,
} from '@/components/features/domain-expert/alerts/AlertsKpiAndStatsBar'
import { useAlert } from '@/hooks/shared/useAlerts'
import InferredAlertsTable from '@/components/features/domain-expert/alerts/InferredAlertsTable'
import ExpertVerdictDrawer from '@/components/features/domain-expert/alerts/ExpertVerdictDrawer'
import {
  useAlertsWithFilters,
  useExpertVerdictStats,
  buildVerdictStatsSummary,
  type AlertTabFilter,
} from '@/hooks/domain-expert/useExpertAlerts'
import type { InferredAlertItem, InferredAlertType } from '@/types/expert.types'
import type { AlertSeverity } from '@/types'
import { useZoneStore } from '@/stores/zoneStore'
import { useAllZones } from '@/hooks/shared/useFarms'
import { t } from '@/i18n'
import { SEVERITY_TO_LEVEL } from '@/constants/severity'
import { levelDict } from '@/constants/severity.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'

function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  )
}

export default function DomainExpertAlertVerdictsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedFarmId } = useZoneStore()
  const farmId = selectedFarmId ?? undefined

  // DE-03: mặc định cả trang trại, Zone là bộ lọc trong card — mọi zone của farm (không giới hạn 1 nhà)
  const [filterZoneId, setFilterZoneId] = useState<string | undefined>(undefined)
  const { data: allZones } = useAllZones()
  const zoneOptions = [
    { value: 'ALL', label: t('Tất cả Zone') },
    ...(allZones ?? []).filter(zone => zone.farmId === farmId).map(zone => ({ value: zone._id, label: zone.name })),
  ]

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<InferredAlertItem | null>(null)
  const [toast, setToast] = useState({ show: false, message: '' })

  const {
    filters,
    setTab,
    setType,
    setSeverity,
    setPage,
    paginatedAlerts,
    filteredTotal,
    kpiCounts,
    totalPages,
    isLoading,
    isFetching,
  } = useAlertsWithFilters(farmId, filterZoneId)
  // Ô lọc mức độ theo 3 cấp chung (FE_Design 2.4)
  const { t: levelLabel } = useTranslation(levelDict)
  const severityOptions = [
    { value: 'ALL', label: t('Mức độ') },
    ...INFERRED_SEVERITIES.map(severity => ({ value: severity, label: levelLabel(SEVERITY_TO_LEVEL[severity]) })),
  ]

  const { data: verdictStats = [] } = useExpertVerdictStats(farmId, filterZoneId)
  const statsSummary = buildVerdictStatsSummary(verdictStats)

  const targetAlertId = searchParams.get('alertId')
  const initialTab = searchParams.get('tab')

  useEffect(() => {
    if (initialTab && ['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'].includes(initialTab.toUpperCase())) {
      setTab(initialTab.toUpperCase() as AlertTabFilter)
    }
  }, [initialTab, setTab])

  // Link từ thông báo (?alertId=): cảnh báo có thể không nằm ở trang đang xem → đọc thẳng GET /alerts/:id
  const targetOnPage = paginatedAlerts.find(a => a._id === targetAlertId)
  const { data: targetFromApi } = useAlert(targetAlertId && !targetOnPage && !selectedAlert ? targetAlertId : null)

  useEffect(() => {
    if (!targetAlertId || selectedAlert) return
    const match = targetOnPage ?? (targetFromApi as InferredAlertItem | undefined)
    if (match) {
      setSelectedAlert(match)
      setDrawerOpen(true)
    }
  }, [targetAlertId, targetOnPage, targetFromApi, selectedAlert])

  const openDrawer = useCallback((alert: InferredAlertItem) => {
    setSelectedAlert(alert)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setTimeout(() => setSelectedAlert(null), 300)
  }, [])

  const handleVerdictSaved = useCallback((_id: string, result: 'CONFIRMED' | 'REJECTED') => {
    const msg = result === 'CONFIRMED' ? t('Đã xác nhận sự cố thật') : t('Đã bác bỏ báo động giả')
    setToast({ show: true, message: msg })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }, [])

  const currentTab = TAB_INFO[filters.tab]
  const isFiltered = filters.type !== 'ALL' || filters.severity !== 'ALL' || filters.tab !== 'ALL' || filterZoneId !== undefined

  return (
    <div className="relative w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto space-y-5">
        {/* 4 Interactive KPI cards */}
        <AlertsKpiAndStatsBar
          counts={kpiCounts}
          isLoading={isLoading}
          activeTab={filters.tab}
          onTabChange={setTab}
        />

        {/* Khung Card danh sách chuẩn hệ thống */}
        <Card size="lg" className="flex flex-col gap-4">
          {/* Header hàng 1: Tiêu đề + Thẻ đếm tab + Bộ lọc SelectMenu */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-warmGray/10">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-charcoal shrink-0">{t('Danh sách cảnh báo')}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-charcoal border border-warmGray/15">
                {t(currentTab.label)} • {kpiCounts[currentTab.countKey]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {zoneOptions.length > 1 && (
                <SelectMenu
                  value={filterZoneId ?? 'ALL'}
                  options={zoneOptions}
                  onChange={val => setFilterZoneId(val === 'ALL' ? undefined : val)}
                  ariaLabel={t('Lọc theo Zone')}
                />
              )}
              <SelectMenu
                value={filters.type}
                options={TYPE_OPTS}
                onChange={val => setType(val as InferredAlertType | 'ALL')}
                ariaLabel={t('Lọc theo loại cảnh báo')}
              />
              <SelectMenu
                value={filters.severity}
                options={severityOptions}
                onChange={val => setSeverity(val as AlertSeverity | 'ALL')}
                ariaLabel={t('Lọc theo mức độ cảnh báo')}
              />
              {isFiltered && (
                <ClearFiltersButton
                  onClick={() => { setType('ALL'); setSeverity('ALL'); setTab('ALL'); setFilterZoneId(undefined) }}
                />
              )}
            </div>
          </div>

          {/* Sub-bar hàng 2: Tỷ lệ xác nhận sự cố thật + Shortcut Chỉnh tham số */}
          <div className="flex items-center justify-between gap-4 text-xs -mt-1 pb-1">
            <div className="flex items-center gap-2 min-w-0 text-warmGray">
              {statsSummary ? (
                <>
                  <Info className="w-3.5 h-3.5 text-[#B5D32C] shrink-0" />
                  <p className="truncate text-small">
                    <span className="font-semibold text-charcoal">{t('Tỷ lệ xác nhận sự cố thật:')}</span> {statsSummary}
                  </p>
                </>
              ) : (
                <span className="text-small text-warmGray">
                  {t('Chưa có kết luận nào trong kỳ. Tỷ lệ xác nhận đúng theo loại cảnh báo hiện khi đã có kết luận.')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/domain-expert/tuning')}
              className="inline-flex items-center gap-1 text-xs text-[#7A9A00] hover:text-[#4A5C00] font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer"
            >
              {t('Chỉnh tham số phát hiện')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bảng dữ liệu chuẩn hệ thống (DataTable + Pagination variant="full") */}
          <InferredAlertsTable
            alerts={paginatedAlerts}
            isLoading={isLoading}
            onOpenDrawer={openDrawer}
            page={filters.page}
            pageSize={5}
            filteredTotal={filteredTotal}
            totalPages={totalPages}
            onPageChange={setPage}
            isFetching={isFetching}
          />
        </Card>
      </div>

      <ExpertVerdictDrawer
        alert={selectedAlert}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onVerdictSaved={handleVerdictSaved}
      />
      <Toast show={toast.show} message={toast.message} />
    </div>
  )
}
