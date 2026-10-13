// useTicketChat — TICKET-FR-014..017: logic chat realtime cho 1 ticket
// Luồng: REST GET /tickets/:id/messages nạp lịch sử → socket JOIN_TICKET_CHAT nhận TICKET_MESSAGE_NEW
// (append vào cache react-query, dedupe theo _id). Join thất bại (403 / mất kết nối) → polling REST 10s.
// Socket reconnect → join lại room + refetch lịch sử để bù tin nhắn phát ra trong lúc mất kết nối.
// Gửi tin qua REST POST kèm client_message_id (idempotent).
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/apis/shared/tickets.api'
import { useSocket } from '@/hooks/common/useSocket'
import {
  getSocket,
  joinTicketChat,
  leaveTicketChat,
  onTicketMessage,
  onTicketAssigneeChanged,
} from '@/lib/socket'
import type { TicketChatMessage } from '@/types'

export const ticketChatKey = (ticketId: string) => ['tickets', 'chat', ticketId] as const

export function useTicketChat(ticketId: string, enabled: boolean) {
  const queryClient = useQueryClient()
  // true khi socket join OK → tắt polling; false → polling REST dự phòng
  const [live, setLive] = useState(false)
  useSocket()

  const queryKey = ticketChatKey(ticketId)

  const query = useQuery<TicketChatMessage[]>({
    queryKey,
    queryFn: () => ticketApi.listMessages(ticketId).then(r => r.data.data),
    retry: false,
    enabled,
    refetchInterval: live ? false : 10_000,
  })

  const appendMessage = useCallback(
    (msg: TicketChatMessage) => {
      queryClient.setQueryData<TicketChatMessage[]>(ticketChatKey(ticketId), (old = []) =>
        old.some(m => m._id === msg._id) ? old : [...old, msg],
      )
    },
    [queryClient, ticketId],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let joined = false
    const socket = getSocket()

    const join = () => {
      void joinTicketChat(ticketId).then(ack => {
        if (cancelled) {
          if (ack.ok) leaveTicketChat(ticketId)
          return
        }
        joined = ack.ok
        setLive(ack.ok)
      })
    }

    // Mất kết nối → bật polling ngay; kết nối lại → join lại + bù lịch sử
    const handleDisconnect = () => {
      joined = false
      setLive(false)
    }
    const handleReconnect = () => {
      join()
      void queryClient.invalidateQueries({ queryKey: ticketChatKey(ticketId) })
    }

    join()
    socket.on('disconnect', handleDisconnect)
    socket.on('connect', handleReconnect)

    const offMsg = onTicketMessage(msg => {
      if (msg.ticket_id === ticketId) appendMessage(msg)
    })
    const offAssignee = onTicketAssigneeChanged(evt => {
      if (evt.ticketId !== ticketId) return
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    })

    return () => {
      cancelled = true
      socket.off('disconnect', handleDisconnect)
      socket.off('connect', handleReconnect)
      offMsg()
      offAssignee()
      if (joined) leaveTicketChat(ticketId)
    }
  }, [ticketId, enabled, appendMessage, queryClient])

  const send = useMutation({
    mutationFn: (content: string) =>
      ticketApi.sendMessage(ticketId, content, crypto.randomUUID()).then(r => r.data.data),
    onSuccess: appendMessage,
  })

  return { ...query, messages: query.data ?? [], live, send }
}
