// Ticket Detail Page – stub: implement in TASK-M4 sprint (Module TICKET §5.9, D6)
// SRS: see WORKPLAN.md
import { useParams } from 'react-router-dom'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Ticket #{id}</h1>
      <p className="text-slate-400 mt-2">Coming soon – see WORKPLAN.md</p>
    </div>
  )
}
