import { useState } from 'react'
import { Button, Card, StarRating } from '@/components/ui'
import { useRateTicket } from '@/hooks/shared/useTickets'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { supportDict } from '@/constants/support.i18n'
import type { Ticket } from '@/types'

// Thẻ đánh giá 1–5 sao sau khi yêu cầu hoàn tất
export default function TicketRatingCard({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation(supportDict)
  const rateTicket = useRateTicket()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [rating, setRating] = useState(0)

  if (ticket.satisfaction_rating) {
    return (
      <Card size="lg" className="flex flex-col gap-2">
        <h2 className="text-h2 text-charcoal">{t('rating.yoursTitle')}</h2>
        <StarRating value={ticket.satisfaction_rating} readOnly />
        <p className="text-small text-warmGray">{t('rating.contactAdmin')}</p>
      </Card>
    )
  }

  return (
    <Card size="lg" className="flex flex-col gap-3">
      <div>
        <h2 className="text-h2 text-charcoal">{t('rating.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('rating.desc')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <StarRating value={rating} onChange={setRating} />
        <Button
          size="sm"
          disabled={rating === 0}
          loading={rateTicket.isPending}
          onClick={() => rateTicket.mutate({ id: ticket._id, rating }, {
            onSuccess: () => push(t('rating.sent')),
            onError: error => push(apiErrorMessage(error, t('rating.failed')), 'error'),
          })}
        >
          {t('rating.submit')}
        </Button>
      </div>
    </Card>
  )
}
