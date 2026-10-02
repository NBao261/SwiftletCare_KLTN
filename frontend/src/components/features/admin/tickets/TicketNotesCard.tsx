import { useState, FormEvent } from 'react'
import { ChatTextIcon } from '@phosphor-icons/react'
import { useAddTicketNote } from '@/hooks/shared/useTickets'
import { Button, Textarea } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import type { Ticket } from '@/types'

/**
 * "Lịch sử xử lý" + thêm ghi chú (TICKET-FR-009) trên AdminTicketDetailPage — dạng dòng thời gian:
 * chấm + vạch dọc nối các ghi chú theo thứ tự backend trả về (cũ → mới), ghi chú mới nhất chấm lime.
 */
export default function TicketNotesCard({ ticketId, notes }: { ticketId: string; notes: Ticket['notes'] }) {
  const addNote = useAddTicketNote()
  const push = useToastStore(s => s.push)
  const [content, setContent] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addNote.mutate({ id: ticketId, content: content.trim() }, {
      onSuccess: () => setContent(''),
      onError: (err) => push(getApiErrorMessage(err, 'Thêm ghi chú thất bại'), 'error'),
    })
  }

  return (
    <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
          <ChatTextIcon size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">Lịch sử xử lý</h2>
          <p className="text-small text-graphite">{notes.length} ghi chú · mới nhất ở cuối</p>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-body text-warmGray">Chưa có ghi chú nào.</p>
      ) : (
        <ol className="flex flex-col">
          {notes.map((note, i) => {
            const last = i === notes.length - 1
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Vạch dọc nối sang ghi chú kế tiếp */}
                {!last && <span className="absolute left-[5px] top-4 h-full w-px bg-warmGray/20" aria-hidden />}
                <span className={last ? 'mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-accent-300 ring-2 ring-charcoal' : 'mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-warmGray/30'} />
                <div className="min-w-0 flex-1 rounded-xl bg-warmGray/5 px-3.5 py-2.5">
                  <p className="whitespace-pre-line text-body text-charcoal">{note.content}</p>
                  <p className="mt-1 text-small tabular-nums text-warmGray">{formatDate(note.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-warmGray/10 pt-4">
        <Textarea placeholder="Thêm ghi chú..." value={content} onChange={e => setContent(e.target.value)} />
        <Button type="submit" size="sm" loading={addNote.isPending} disabled={!content.trim()} className="self-end">
          Thêm ghi chú
        </Button>
      </form>
    </section>
  )
}
