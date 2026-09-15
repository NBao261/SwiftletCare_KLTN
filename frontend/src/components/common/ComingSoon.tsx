/** ComingSoon – khung chuẩn cho trang chưa triển khai (backend module còn là stub 501) */
export default function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-warmGray/30 px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-charcoal">{title}</h1>
      <p className="text-sm text-warmGray">
        {note ?? 'Backend module này hiện là stub (501) — xem backend/README.md mục "Module → phạm vi".'}
      </p>
    </div>
  )
}
