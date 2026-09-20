// AddNoteCard.tsx — C3: Standalone ghi chú form cho Technician
import { useState } from 'react'
import { useAddTicketNote } from '@/hooks/useTickets'
import { Button, Card, Textarea } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'

interface Props {
  ticketId: string
}

export function AddNoteCard({ ticketId }: Props) {
  const addNote = useAddTicketNote()
  const push = useToastStore(s => s.push)
  const [content, setContent] = useState('')
  const charCount = content.length

  function handleSubmit() {
    if (!content.trim()) return
    addNote.mutate({ id: ticketId, content }, {
      onSuccess: () => { setContent(''); push('Ghi chú đã được thêm') },
      onError: (err) => push(getApiErrorMessage(err, 'Thêm ghi chú thất bại'), 'error'),
    })
  }

  return (
    <Card className="!p-5">
      <p className="label-caption mb-3">THÊM GHI CHÚ</p>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Ghi chú tiến độ xử lý, kết quả kiểm tra... (Farm Owner cũng thấy ghi chú này)"
        rows={4}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs ${charCount > 450 ? 'text-climateOrange' : 'text-warmGray'}`}>
          {charCount}/500
        </span>
        <Button
          onClick={handleSubmit}
          loading={addNote.isPending}
          disabled={!content.trim()}
          size="sm"
        >
          Gửi ghi chú
        </Button>
      </div>
    </Card>
  )
}
