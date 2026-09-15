// Listing Detail Page (public, Traceability Card) – stub: implement in TASK-M4 sprint
// SRS: MARKET-FR-009, see WORKPLAN.md
import { useParams } from 'react-router-dom'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Sản phẩm #{id}</h1>
      <p className="text-slate-400 mt-2">Coming soon – see WORKPLAN.md</p>
    </div>
  )
}
