/**
 * ExpertScadaKpiPills — 3 KPI Pills trên thanh SCADA Chuyên gia
 * - AUTO% (Cpu icon)
 * - Cảnh báo chờ kiểm chứng (AlertTriangle icon, link tới /expert/audit-logs)
 * - Báo cáo chờ kết luận (FileText icon, link tới /expert/reports)
 * SRS: EXPERT-FR-003, EXPERT-FR-005
 */

import { Link } from 'react-router-dom'
import { Cpu, AlertTriangle, FileText } from 'lucide-react'

interface Props {
  autoModePct: number
  pendingCount: number
  pendingReports: number
}

export default function ExpertScadaKpiPills({ autoModePct, pendingCount, pendingReports }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
      {/* KPI 1: % chế độ AUTO (link tới Analytics) */}
      <Link
        to="/expert/analytics"
        className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-3 py-1.5 transition-colors hover:bg-success/25"
      >
        <Cpu size={12} className="text-success" />
        <span className="text-xs font-bold text-success">{autoModePct.toFixed(1)}%</span>
        <span className="text-[11px] text-white/60">AUTO</span>
      </Link>

      {/* KPI 2: Cảnh báo chờ kiểm chứng (link tới Audit Logs với tab PENDING) */}
      <Link
        to="/expert/audit-logs?tab=PENDING"
        className="flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1.5 transition-colors hover:bg-orange-500/25"
      >
        <AlertTriangle size={12} className="text-orange-400" />
        <span className="text-xs font-bold text-orange-400">{String(pendingCount).padStart(2, '0')}</span>
        <span className="text-[11px] text-white/60">Cảnh báo chờ</span>
      </Link>

      {/* KPI 3: Báo cáo chờ kết luận (link tới Health Reports) */}
      <Link
        to="/expert/reports"
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
      >
        <FileText size={12} className="text-white/70" />
        <span className="text-xs font-bold text-white">{String(pendingReports).padStart(2, '0')}</span>
        <span className="text-[11px] text-white/60">Báo cáo chờ</span>
      </Link>
    </div>
  )
}
