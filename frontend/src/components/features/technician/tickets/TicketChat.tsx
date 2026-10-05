// TicketChat.tsx — TICKET-FR-014..017: Chat realtime giữa Technician ↔ Farm Owner
// Dùng trong: TechnicianTicketDetailPage (cột trái, dưới notes)
// Luồng: REST GET /tickets/:id/messages nạp lịch sử → socket JOIN_TICKET_CHAT nhận TICKET_MESSAGE_NEW
// (append vào cache react-query, dedupe theo _id). Join thất bại (403 đã chuyển ticket / mất kết nối) →
// rơi về polling REST 10s. Gửi tin qua REST POST kèm client_message_id (idempotent).
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/apis/shared/tickets.api'
import { Button } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage, formatDate } from '@/lib/helpers'
import { useAuthStore } from '@/stores/authStore'
import { useSocket } from '@/hooks/common/useSocket'
import { joinTicketChat, leaveTicketChat, onTicketMessage, onTicketAssigneeChanged } from '@/lib/socket'
import type { TicketChatMessage } from '@/types'

interface Props {
  ticketId: string
  /** Ticket đã CLOSED → BE từ chối gửi (409), chỉ đọc lịch sử */
  closed?: boolean
  /** false → chỉ đọc (VD Technician không phải người phụ trách) */
  /** false → chỉ đọc (VD Technician không phải người phụ trách) */
  canSend?: boolean
  /** State quản lý mở đóng Drawer */
  open: boolean
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  FARM_OWNER: 'Farm Owner',
  TECHNICIAN: 'Technician',
  ADMIN: 'Admin',
  SYSTEM: 'Hệ thống',
}

export function TicketChat({ ticketId, closed = false, canSend = true, open, onClose }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [text, setText] = useState('')
  // true khi socket join OK → tắt polling; false → polling REST dự phòng
  const [live, setLive] = useState(false)
  // containerRef — scroll trong nội bộ chat, KHÔNG đụng đến scroll của trang
  const containerRef = useRef<HTMLDivElement>(null)
  useSocket()

  const queryKey = ['tickets', 'chat', ticketId] as const

  const { data: messages = [], isLoading, isError, error } = useQuery<TicketChatMessage[]>({
    queryKey,
    queryFn: () => ticketApi.listMessages(ticketId).then(r => r.data.data),
    retry: false,
    enabled: open, // Chỉ fetch khi mở Drawer
    refetchInterval: live ? false : 10_000,
  })

  const appendMessage = useCallback(
    (msg: TicketChatMessage) => {
      queryClient.setQueryData<TicketChatMessage[]>(['tickets', 'chat', ticketId], (old = []) => {
        if (old.some(m => m._id === msg._id)) return old
        return [...old, msg]
      })
    },
    [queryClient, ticketId],
  )

  // Socket: join room + nhận tin mới + đổi người phụ trách
  useEffect(() => {
    let cancelled = false
    let joined = false

    if (!open) return // Chỉ join socket khi đang mở chat
    void joinTicketChat(ticketId).then(ack => {
      if (cancelled) {
        if (ack.ok) leaveTicketChat(ticketId)
        return
      }
      joined = ack.ok
      setLive(ack.ok)
    })

    const offMsg = onTicketMessage(msg => {
      if (msg.ticket_id === ticketId) appendMessage(msg)
    })
    const offAssignee = onTicketAssigneeChanged(evt => {
      if (evt.ticketId !== ticketId) return
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    })

    return () => {
      cancelled = true
      offMsg()
      offAssignee()
      if (joined) leaveTicketChat(ticketId)
    }
  }, [ticketId, appendMessage, queryClient, open])

  // Chỉ scroll xuống khi có tin nhắn thực sự — scroll trong container, không cuốn toàn trang
  useEffect(() => {
    if (messages.length === 0) return
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const sendMut = useMutation({
    mutationFn: (content: string) => ticketApi.sendMessage(ticketId, content, crypto.randomUUID()),
    onSuccess: res => {
      appendMessage(res.data.data)
      setText('')
    },
    onError: err => push(getApiErrorMessage(err, 'Gửi tin nhắn thất bại'), 'error'),
  })

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 2000) return
    sendMut.mutate(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const readOnly = closed || !canSend
  const forbidden = isError && (error as { response?: { status?: number } })?.response?.status === 403

  return (
    <Drawer open={open} onClose={onClose} title="Trò chuyện với Farm Owner">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-caption">TICKET CHAT</p>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${live ? 'text-emerald-600' : 'text-warmGray'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-warmGray/40'}`} />
          {live ? 'Trực tiếp' : 'Tự làm mới'}
        </span>
      </div>

      {/* Message list */}
      <div ref={containerRef} className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {isLoading && <p className="py-6 text-center text-sm text-warmGray">Đang tải tin nhắn…</p>}

        {isError && (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-charcoal">
              {forbidden ? 'Bạn không có quyền xem cuộc trò chuyện này' : 'Không tải được tin nhắn'}
            </p>
            <p className="text-xs text-warmGray">{getApiErrorMessage(error, 'Vui lòng thử lại sau.')}</p>
          </div>
        )}

        {!isError && !isLoading && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-warmGray">
            Chưa có tin nhắn nào.{readOnly ? '' : ' Bắt đầu cuộc trò chuyện với Farm Owner.'}
          </p>
        )}

        {messages.map(msg => {
          if (msg.is_system || msg.role === 'SYSTEM') {
            return (
              <div key={msg._id} className="flex flex-col items-center gap-0.5 py-1">
                <span className="rounded-full bg-graphite/5 px-3 py-1 text-center text-xs italic text-warmGray">{msg.content}</span>
                <span className="text-[10px] text-warmGray/70">{formatDate(msg.created_at)}</span>
              </div>
            )
          }
          const isMine = msg.author_id === user?._id
          return (
            <div key={msg._id} className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warmGray">
                  {msg.author_name ?? 'Người dùng'} · {ROLE_LABEL[msg.role] ?? msg.role}
                </span>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isMine
                    ? 'rounded-br-sm bg-charcoal text-white'
                    : 'rounded-bl-sm border border-graphite/15 bg-warmGray/5 text-charcoal'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-warmGray/70">{formatDate(msg.created_at)}</span>
            </div>
          )
        })}
      </div>

      {/* Input */}
      {!isError && !readOnly && (
        <div className="mt-3 flex gap-2 border-t border-graphite/10 pt-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder="Nhắn tin với Farm Owner… (Enter để gửi, Shift+Enter xuống dòng)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-graphite/20 bg-transparent px-3.5 py-2.5 text-sm text-charcoal placeholder:text-warmGray/60 focus:border-charcoal focus:outline-none"
          />
          <Button onClick={handleSend} loading={sendMut.isPending} disabled={!text.trim()} className="shrink-0 self-end">
            Gửi
          </Button>
        </div>
      )}
      {!isError && readOnly && (
        <p className="mt-3 border-t border-graphite/10 pt-3 text-xs text-warmGray">
          {closed ? 'Ticket đã đóng — chỉ xem lại lịch sử trò chuyện.' : 'Bạn không phải người phụ trách ticket này — chỉ xem lịch sử trò chuyện.'}
        </p>
      )}
    </Drawer>
  )
}
