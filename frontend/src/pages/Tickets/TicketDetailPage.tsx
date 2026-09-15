// Ticket Detail Page – stub: backend controllers/tickets.ts chưa có logic (501)
// SRS: Module TICKET §5.9
import { useParams } from 'react-router-dom'
import ComingSoon from '@/components/common/ComingSoon'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <ComingSoon title={`Ticket #${id}`} />
}
