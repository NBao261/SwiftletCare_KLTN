import { TrendingUp, ThumbsUp, Sparkles } from 'lucide-react'
import type { RecommendationEffect } from '@/types/expert.types'

interface Props {
  effects: RecommendationEffect[]
}

export default function RecommendationEffectPanel({ effects }: Props) {
  const totals = effects.reduce(
    (acc, e) => ({
      generated: acc.generated + e.total_generated,
      accepted:  acc.accepted  + e.total_accepted,
      improved:  acc.improved  + e.total_improved,
    }),
    { generated: 0, accepted: 0, improved: 0 },
  )

  return (
    <div className="space-y-3">
      {/* KPI tổng */}
      <div className="grid grid-cols-3 gap-3">
        <KpiTile icon={<Sparkles className="w-4 h-4 text-blue-500" />} label="Đã tạo" value={totals.generated} />
        <KpiTile icon={<ThumbsUp className="w-4 h-4 text-green-500" />} label="Đã chấp nhận" value={totals.accepted} />
        <KpiTile icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} label="Có cải thiện" value={totals.improved} />
      </div>

      {/* Bảng theo luật */}
      {effects.length > 0 && (
        <div className="rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] text-[#878380] font-semibold">
                <th className="text-left px-3 py-2">Luật</th>
                <th className="text-right px-3 py-2">Tạo</th>
                <th className="text-right px-3 py-2">Chấp nhận</th>
                <th className="text-right px-3 py-2">Cải thiện</th>
              </tr>
            </thead>
            <tbody>
              {effects.map(e => (
                <tr key={e.rule_id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60">
                  <td className="px-3 py-2 text-[#27231F] font-medium max-w-0 truncate" style={{ maxWidth: '14rem' }}>{e.rule_name}</td>
                  <td className="px-3 py-2 text-right text-[#878380]">{e.total_generated}</td>
                  <td className="px-3 py-2 text-right text-[#878380]">{e.total_accepted}</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">{e.total_improved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <p className="text-lg font-bold text-[#27231F]">{value}</p>
      <p className="text-[11px] text-[#878380]">{label}</p>
    </div>
  )
}
