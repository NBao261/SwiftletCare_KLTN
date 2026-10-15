import { useEffect, useRef, useState, FormEvent } from 'react'
import { useAddTicketNote } from '@/hooks/shared/useTickets'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { Button, Textarea } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { formatDayTime, getApiErrorMessage } from '@/lib/helpers'
import type { Ticket } from '@/types'

/**
 * "Lịch sử xử lý" + thêm ghi chú (TICKET-FR-009) trên AdminTicketDetailPage — dạng dòng thời gian:
 * chấm + vạch dọc nối các ghi chú theo thứ tự backend trả về (cũ → mới), ghi chú mới nhất chấm lime.
 */
export default function TicketNotesCard({ ticketId, notes, className }: { ticketId: string; notes: Ticket['notes']; className?: string }) {
  const addNote = useAddTicketNote()
  const push = useToastStore(s => s.push)
  const [content, setContent] = useState('')
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [notes.length])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addNote.mutate({ id: ticketId, content: content.trim() }, {
      onSuccess: () => setContent(''),
      onError: (err) => push(getApiErrorMessage(err, 'Thêm ghi chú thất bại'), 'error'),
    })
  }

  return (
    // flex-col + ô thêm ghi chú mt-auto: card kéo cao bằng cột bên cạnh thì ô nhập vẫn nằm ở đáy
    <section className={cn('flex flex-col rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card', className)}>
      <div className="mb-4">
        <h2 className="text-h2 text-charcoal">{t('Lịch sử xử lý')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('Trao đổi và cập nhật trong quá trình xử lý ticket · {{n}} ghi chú', { n: notes.length })}</p>
      </div>

      {notes.length === 0 ? (
        <p className="mb-4 flex h-[21rem] items-center justify-center rounded-xl border border-dashed border-warmGray/30 text-body italic text-warmGray lg:h-auto lg:min-h-0 lg:flex-1">{t('Chưa có ghi chú nào.')}</p>
      ) : (
        // Màn lớn: danh sách lấp phần còn lại của card (card cao bằng cột phải), nhiều ghi chú thì cuộn; màn nhỏ: khung
        // cố định 21rem. pr-2 chừa thanh cuộn; pl-1/py-0.5 để viền ring của chấm mới nhất không bị khung cuộn cắt;
        // mở trang/thêm ghi chú tự cuộn xuống ghi chú mới nhất
        <ol ref={listRef} className="mb-4 flex h-[21rem] flex-col overflow-y-auto py-0.5 pl-1 pr-2 lg:h-auto lg:min-h-0 lg:flex-1">
          {notes.map((note, i) => {
            const last = i === notes.length - 1
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Vạch dọc nối sang ghi chú kế tiếp */}
                {!last && <span className="absolute left-[5px] top-4 h-full w-px bg-warmGray/20" aria-hidden />}
                <span className={last ? 'mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-limeMist ring-2 ring-charcoal' : 'mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-warmGray/30'} />
                <div className="min-w-0 flex-1 rounded-xl bg-warmGray/5 px-3.5 py-2.5">
                  <p className="whitespace-pre-line text-body text-charcoal">{note.content}</p>
                  <p className="mt-1 text-small text-warmGray">{formatDayTime(note.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="mt-auto flex flex-col gap-2 border-t border-warmGray/10 pt-4">
        <Textarea placeholder="Thêm ghi chú..." value={content} onChange={e => setContent(e.target.value)} />
        <Button type="submit" size="sm" loading={addNote.isPending} disabled={!content.trim()} className="self-end">
          Thêm ghi chú
        </Button>
      </form>
    </section>
  )
}
