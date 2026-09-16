import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api'
import type { CreateTicketInput, ListTicketsQuery } from '@/services/api/tickets'

/** Module TICKET §5.9 */
export function useTicketsList(query: ListTicketsQuery) {
  const result = useQuery({
    queryKey: ['tickets', query],
    queryFn: () => ticketApi.list(query),
  })
  return {
    records: result.data?.data.data ?? [],
    total: result.data?.data.meta?.total ?? 0,
    page: result.data?.data.meta?.page ?? query.page ?? 1,
    limit: result.data?.data.meta?.limit ?? query.limit ?? 20,
    isLoading: result.isLoading,
  }
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketApi.getOne(id!).then(r => r.data.data),
    enabled: !!id,
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTicketInput) => ticketApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

function invalidateTicket(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: ['tickets'] })
  void queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', id] })
}

/** Flow 9 case 6c / Flow 9b case 4a — Farm Owner tự huỷ ticket của mình */
export function useCancelTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => ticketApi.cancel(id, reason),
    onSuccess: (_data, { id }) => invalidateTicket(queryClient, id),
  })
}

export function useAddTicketNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => ticketApi.addNote(id, content),
    onSuccess: (_data, { id }) => invalidateTicket(queryClient, id),
  })
}

/** TICKET-FR-011 — đánh giá sau khi ticket đóng */
export function useRateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => ticketApi.rate(id, rating),
    onSuccess: (_data, { id }) => invalidateTicket(queryClient, id),
  })
}
