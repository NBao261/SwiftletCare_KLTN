import { Link } from 'react-router-dom'
import { Cpu, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { t } from '@/i18n'

interface Props {
  autoModePct: number
  pendingCount: number
  pendingReports: number
}

export default function ExpertScadaKpiPills({ autoModePct, pendingCount, pendingReports }: Props) {
  const hasPendingAlerts = pendingCount > 0
  const hasPendingReports = pendingReports > 0

  return (
    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
      {/* KPI 1: % Vận hành tự động vi khí hậu 24h (Fuzzy Logic Controller) */}
      <Link
        to="/analytics"
        title={t('Tỷ lệ thời gian vi khí hậu chạy tự động trong 24 giờ qua')}
        className="group flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent-600/30 bg-accent-50/80 px-2.5 sm:px-3 transition-all hover:border-accent-600/50 hover:bg-accent-100/70 active:scale-[0.98]"
      >
        <Cpu size={13} className="shrink-0 text-accent-800" />
        <span className="font-mono text-xs font-bold tabular-nums text-accent-900">
          {autoModePct.toFixed(0)}%
        </span>
        <span className="text-[11px] font-semibold text-accent-800">{t('Tự động')}</span>
      </Link>

      {/* KPI 2: Cảnh báo AI chờ thẩm định (Chỉ đổi màu báo động khi CÓ việc chờ) */}
      <Link
        to="/domain-expert/alert-verdicts"
        title={hasPendingAlerts ? t('{{n}} cảnh báo suy luận đang chờ chuyên gia kết luận', { n: pendingCount }) : t('Không có cảnh báo tồn đọng')}
        className={`group flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 sm:px-3 transition-all active:scale-[0.98] ${
          hasPendingAlerts
            ? 'border border-amber-400 bg-amber-50 hover:border-amber-500 hover:bg-amber-100/80 shadow-sm'
            : 'border border-warmGray/25 bg-stone/50 hover:border-warmGray/40 hover:bg-stone/80 text-graphite'
        }`}
      >
        {hasPendingAlerts ? (
          <>
            <AlertTriangle size={13} className="shrink-0 text-amber-600" />
            <span className="font-mono text-xs font-bold tabular-nums text-amber-900">
              {pendingCount}
            </span>
            <span className="text-[11px] font-semibold text-amber-800">{t('Cảnh báo chờ')}</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={13} className="shrink-0 text-accent-700" />
            <span className="font-mono text-xs font-medium tabular-nums text-graphite">
              0
            </span>
            <span className="text-[11px] text-warmGray">{t('Cảnh báo tồn')}</span>
          </>
        )}
      </Link>

      {/* KPI 3: Báo cáo sức khỏe zone chờ chuyên gia kết luận */}
      <Link
        to="/domain-expert/reports"
        title={hasPendingReports ? t('{{n}} báo cáo đang chờ chuyên gia kết luận', { n: pendingReports }) : t('Không có báo cáo chờ kết luận')}
        className={`group flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 sm:px-3 transition-all active:scale-[0.98] ${
          hasPendingReports
            ? 'border border-sky-400 bg-sky-50 hover:border-sky-500 hover:bg-sky-100/80 shadow-sm'
            : 'border border-warmGray/25 bg-stone/50 hover:border-warmGray/40 hover:bg-stone/80 text-graphite'
        }`}
      >
        <FileText size={13} className={`shrink-0 ${hasPendingReports ? 'text-sky-600' : 'text-warmGray'}`} />
        <span className={`font-mono text-xs tabular-nums ${hasPendingReports ? 'font-bold text-sky-900' : 'font-medium text-graphite'}`}>
          {pendingReports}
        </span>
        <span className={`text-[11px] ${hasPendingReports ? 'font-semibold text-sky-800' : 'text-warmGray'}`}>
          {hasPendingReports ? t('Báo cáo chờ') : t('Báo cáo tồn')}
        </span>
      </Link>
    </div>
  )
}
