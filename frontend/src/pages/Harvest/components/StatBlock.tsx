export default function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-warmGray">{label}</p>
      <p className="text-xl font-extrabold text-charcoal">{value}</p>
    </div>
  )
}
