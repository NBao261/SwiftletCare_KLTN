/**
 * Màn hình 02A_Expert_Alerts_v3 — Kiểm chứng Cảnh báo Suy luận (Page Shell)
 * Orchestrate: AlertsKpiAndStatsBar + InferredAlertsTable + ExpertVerdictDrawer
 * SRS v2.1.4: EXPERT-FR-003, ENV-FR-019
 */
import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import AlertsKpiAndStatsBar from '@/components/features/expert/alerts/AlertsKpiAndStatsBar'
import InferredAlertsTable from '@/components/features/expert/alerts/InferredAlertsTable'
import ExpertVerdictDrawer from '@/components/features/expert/alerts/ExpertVerdictDrawer'
import {
  useAlertsWithFilters,
  useExpertVerdictStats,
  buildVerdictStatsSummary,
} from '@/hooks/expert/useExpertAlerts'
import type { InferredAlertItem } from '@/types/expert.types'
import { useZoneStore } from '@/stores/zoneStore'

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ExpertAuditLogsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedFarmId, selectedZoneId } = useZoneStore()
  const farmId = selectedFarmId ?? undefined
  const zoneId = selectedZoneId ?? undefined

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<InferredAlertItem | null>(null)
  const [toast, setToast] = useState({ show: false, message: '' })

  const { filters, setTab, setType, setSeverity, setPage, paginatedAlerts,
    filteredTotal, kpiCounts, totalPages, isLoading, isFetching } = useAlertsWithFilters(farmId, zoneId)
  const { data: verdictStats = [] } = useExpertVerdictStats(farmId, zoneId)
  const statsSummary = buildVerdictStatsSummary(verdictStats)

  const targetAlertId = searchParams.get('alertId')
  const initialTab = searchParams.get('tab')

  useEffect(() => {
    if (initialTab && ['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'].includes(initialTab.toUpperCase())) {
      setTab(initialTab.toUpperCase() as any)
    }
  }, [initialTab, setTab])

  useEffect(() => {
    if (targetAlertId && paginatedAlerts.length > 0 && !selectedAlert) {
      const match = paginatedAlerts.find(a => a._id === targetAlertId)
      if (match) {
        setSelectedAlert(match)
        setDrawerOpen(true)
      }
    }
  }, [targetAlertId, paginatedAlerts, selectedAlert])

  const openDrawer = useCallback((alert: InferredAlertItem) => { setSelectedAlert(alert); setDrawerOpen(true) }, [])
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setTimeout(() => setSelectedAlert(null), 300) }, [])

  const handleVerdictSaved = useCallback((_id: string, result: 'CONFIRMED' | 'REJECTED') => {
    const msg = result === 'CONFIRMED' ? 'Đã xác nhận sự cố thật' : 'Đã bác bỏ báo động giả'
    setToast({ show: true, message: msg })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }, [])

  return (
    <div className="relative w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto space-y-0">
        <AlertsKpiAndStatsBar
          counts={kpiCounts} isLoading={isLoading} activeTab={filters.tab}
          activeType={filters.type} activeSeverity={filters.severity} statsSummary={statsSummary}
          onTabChange={setTab} onTypeChange={setType} onSeverityChange={setSeverity}
          onNavigateTuning={() => navigate('/expert/tuning')}
        />

        {/* Bảng + Phân trang — nối tiếp phần header trên */}
        <div className="bg-white rounded-b-2xl border border-neutral-100 border-t-0 overflow-hidden shadow-sm">
          <InferredAlertsTable
            alerts={paginatedAlerts} isLoading={isLoading} onOpenDrawer={openDrawer}
            page={filters.page} filteredTotal={filteredTotal} totalPages={totalPages}
            onPageChange={setPage} isFetching={isFetching}
          />
        </div>
      </div>

      <ExpertVerdictDrawer alert={selectedAlert} isOpen={drawerOpen} onClose={closeDrawer} onVerdictSaved={handleVerdictSaved} />
      <Toast show={toast.show} message={toast.message} />
    </div>
  )
}
