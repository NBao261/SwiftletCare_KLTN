// TicketChat.tsx — TICKET-FR-014..017: Chat realtime giữa Technician ↔ Farm Owner
// Dùng trong: TechnicianTicketDetailPage (cột trái, dưới notes)
// Khi backend có endpoint: thay URL hardcode + kết nối socket TICKET_CHAT_NEW_MESSAGE
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Button, Card } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage, formatDate } from '@/utils/helpers'
import { useAuthStore } from '@/store/authStore'

interface TicketMessage {
  _id: string
  content: string
  author_id: string
  author_name: string
  role: 'TECHNICIAN' | 'FARM_OWNER' | 'ADMIN' | 'SYSTEM'
  created_at: string
}

interface Props {
  ticketId: string
}

export function TicketChat({ ticketId }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  // containerRef — scroll trong nội bộ chat, KHÔNG đụng đến scroll của trang
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch tin nhắn — khi backend ready: ticketApi.getMessages(ticketId)
  // retry: false + refetchInterval disabled — tránh spam 404 khi endpoint chưa impl
  const { data: messages = [], isLoading, isError } = useQuery<TicketMessage[]>({
    queryKey: ['tickets', 'chat', ticketId],
    queryFn: () =>
      ticketApi.getMessages(ticketId).then(r => r.data.data as TicketMessage[]),
    retry: false,
    // refetchInterval: 15_000, // TODO: bật lại khi BE endpoint ready
  })

  // Chỉ scroll xuống khi có tin nhắn thực sự — tránh kéo trang xuống cuối khi mount
  useEffect(() => {
    if (messages.length === 0) return
    // Scroll trong container nội bộ, không dùng scrollIntoView (sẽ cuốn toàn trang)
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const sendMut = useMutation({
    mutationFn: (content: string) => ticketApi.sendMessage(ticketId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'chat', ticketId] })
      setText('')
    },
    onError: (err) => push(getApiErrorMessage(err, 'Gửi tin nhắn thất bại'), 'error'),
  })

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    sendMut.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="!p-5">
      <p className="label-caption mb-3">CHAT VỚI FARM OWNER</p>

      {/* Message list */}
      <div ref={containerRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {isLoading && (
          <p className="py-6 text-center text-sm text-warmGray">Đang tải tin nhắn…</p>
        )}

      {/* Endpoint chưa triển khai — graceful fallback */}
        {isError && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="text-2xl">🔧</span>
            <p className="text-sm font-medium text-charcoal">Tính năng chat đang phát triển</p>
            <p className="text-xs text-warmGray">Endpoint backend chưa sẵn sàng. Hãy dùng phần Ghi chú ở trên để liên lạc.</p>
          </div>
        )}

        {!isError && !isLoading && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-warmGray">
            Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện với Farm Owner.
          </p>
        )}

        {messages.map(msg => {
          const isMine = msg.author_id === user?._id
          return (
            <div
              key={msg._id}
              className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}
            >
              {/* Author label */}
              {!isMine && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warmGray">
                  {msg.author_name} · {msg.role === 'FARM_OWNER' ? 'Farm Owner' : msg.role}
                </span>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isMine
                    ? 'rounded-br-sm bg-charcoal text-white'
                    : msg.role === 'SYSTEM'
                      ? 'rounded-bl-sm border border-graphite/15 bg-graphite/5 italic text-warmGray'
                      : 'rounded-bl-sm border border-graphite/15 bg-warmGray/5 text-charcoal'
                }`}
              >
                {msg.content}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-warmGray/70">{formatDate(msg.created_at)}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input — ẩn khi endpoint chưa impl */}
      {!isError && (
        <div className="mt-3 flex gap-2 border-t border-graphite/10 pt-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhắn tin với Farm Owner… (Enter để gửi, Shift+Enter xuống dòng)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-graphite/20 bg-transparent px-3.5 py-2.5 text-sm text-charcoal placeholder:text-warmGray/60 focus:border-charcoal focus:outline-none"
          />
          <Button
            onClick={handleSend}
            loading={sendMut.isPending}
            disabled={!text.trim()}
            className="shrink-0 self-end"
          >
            Gửi
          </Button>
        </div>
      )}

    </Card>
  )
}
