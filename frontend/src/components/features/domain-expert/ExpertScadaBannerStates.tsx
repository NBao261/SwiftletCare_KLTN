import { Info } from 'lucide-react'

// ─── Sub-component: Skeleton loading state ────────────────────────────────────
export function BannerSkeleton() {
  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-charcoal px-4 py-3 text-white shadow-card lg:flex-nowrap animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <div className="h-3 w-48 rounded-full bg-white/15" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-28 rounded-full bg-white/10" />
        <div className="h-7 w-28 rounded-full bg-white/10" />
        <div className="h-7 w-28 rounded-full bg-white/10" />
      </div>
      <div className="h-9 w-64 rounded-full bg-white/10" />
    </div>
  )
}

// ─── Sub-component: Empty state — chưa được gán trang trại ───────────────────
export function BannerEmpty() {
  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/30 bg-charcoal px-4 py-3 text-white shadow-card lg:flex-nowrap">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
        </span>
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wider text-white">
          GIÁM SÁT VẬN HÀNH SCADA
        </span>
        <span className="text-warmGray/50">•</span>
        <span className="text-xs font-semibold text-orange-400">CHẾ ĐỘ CHUYÊN GIA</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3.5 py-2">
        <Info size={13} className="shrink-0 text-orange-400" />
        <span className="text-xs text-orange-300">
          Chưa được phân công trang trại. Vui lòng liên hệ Chủ trang trại để được cấp quyền.
        </span>
      </div>
    </div>
  )
}
