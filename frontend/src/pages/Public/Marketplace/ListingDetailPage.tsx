// Listing Detail Page (public, Traceability Card) – stub: backend chưa có logic (501)
// SRS: MARKET-FR-009
import { useParams } from 'react-router-dom'
import ComingSoon from '@/components/common/ComingSoon'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <ComingSoon title={`Sản phẩm #${id}`} />
}
