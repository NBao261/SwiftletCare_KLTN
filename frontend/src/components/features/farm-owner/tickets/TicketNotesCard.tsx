import { useState, FormEvent } from 'react'
import { Button, Card, Textarea } from '@/components/ui'
import { useAddTicketNote } from '@/hooks/shared/useTickets'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { supportDict } from '@/constants/support.i18n'
import { noteAuthor, readableNoteText, type NoteAuthor } from '@/components/features/farm-owner/tickets/tickets.constants'
import { useAuthStore } from '@/stores/authStore'
import { formatTimestampsInText } from '@/lib/i18n'
import type { Ticket } from '@/types'

// Nhãn người viết ghi chú
const AUTHOR_LABEL_KEY: Record<NoteAuthor, 'notes.bySystem' | 'notes.byYou' | 'notes.byTechnician' | 'notes.byOther'> = {
  system: 'notes.bySystem',
  you: 'notes.byYou',
  technician: 'notes.byTechnician',
  other: 'notes.byOther',
}

// Nhật ký xử lý của yêu cầu
export default function TicketNotesCard({ ticket }: { ticket: Ticket }) {
  const { t, dateTime } = useTranslation(supportDict)
  const currentUserId = useAuthStore(state => state.user?._id)
  const addNote = useAddTicketNote()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [content, setContent] = useState('')
  const notes = [...ticket.notes].reverse()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    addNote.mutate({ id: ticket._id, content: content.trim() }, {
      onSuccess: () => { setContent(''); push(t('notes.added')) },
      onError: error => push(apiErrorMessage(error, t('notes.addFailed')), 'error'),
    })
  }

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('notes.title')}</h2>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-warmGray">{t('notes.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {notes.map((note, noteIndex) => (
            <li key={`${note.created_at}-${noteIndex}`} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-charcoal/30" aria-hidden />
              <div className="min-w-0 flex-1 rounded-xl bg-warmGray/5 px-3.5 py-2.5">
                <p className="whitespace-pre-wrap break-words text-sm text-charcoal">{readableNoteText(note.content, formatTimestampsInText)}</p>
                <p className="mt-1 text-small text-warmGray">{t(AUTHOR_LABEL_KEY[noteAuthor(note, ticket, currentUserId)])} · {dateTime(note.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {ticket.status !== 'CLOSED' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-warmGray/10 pt-4">
          <Textarea
            id="ticket-note"
            label={t('notes.add')}
            value={content}
            onChange={event => setContent(event.target.value)}
            placeholder={t('notes.placeholder')}
          />
          <Button type="submit" variant="secondary" size="sm" loading={addNote.isPending} disabled={!content.trim()} className="self-end">
            {t('notes.add')}
          </Button>
        </form>
      )}
    </Card>
  )
}
