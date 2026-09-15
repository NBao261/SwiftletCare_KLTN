import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'

export function useTickets(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn:  () => ticketApi.list(params).then(r => r.data),
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn:  () => ticketApi.getOne(id).then(r => r.data),
    enabled:  !!id,
  })
}

export function useAddTicketNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => ticketApi.addNote(id, content),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets', id] })
    },
  })
}
