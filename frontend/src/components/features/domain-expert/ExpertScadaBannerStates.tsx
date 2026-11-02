import { Info } from 'lucide-react'

// ─── Sub-component: Skeleton loading state ────────────────────────────────────
export function BannerSkeleton() {
  return (
    <div className="relative z-30 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 sm:px-4 sm:py-3.5 text-charcoal shadow-sm animate-pulse border border-warmGray/20">
      <div className="flex items-center gap-2.5">
        <div className="h-6 w-24 rounded-full bg-stone" />
        <div className="h-4 w-40 rounded-full bg-stone" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-full bg-stone" />
        <div className="h-8 w-28 rounded-full bg-stone" />
        <div className="h-8 w-28 rounded-full bg-stone" />
      </div>
      <div className="h-9 w-64 rounded-full bg-stone" />
    </div>
  )
}

// ─── Sub-component: Empty state — chưa được gán trang trại ───────────────────
export function BannerEmpty() {
  return (
    <div className="relative z-30 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 sm:px-4 sm:py-3.5 text-charcoal shadow-sm border border-amber-300">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-charcoal">
          Giám Sát Vận Hành SCADA
        </span>
        <span className="text-warmGray/30">•</span>
        <span className="text-xs font-semibold text-amber-700">Chế độ Chuyên gia</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5">
        <Info size={13} className="shrink-0 text-amber-600" />
        <span className="text-xs text-amber-900 font-medium">
          Chưa được phân công trang trại. Vui lòng liên hệ Chủ trang trại để được cấp quyền giám sát.
        </span>
      </div>
    </div>
  )
}
