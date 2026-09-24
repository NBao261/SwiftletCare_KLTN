// SATChecklist.tsx — Nghiệm thu SAT Checklist với interactive checkbox cards
// Dùng trong: TechnicianTicketDetailPage (ticket loại INSTALLATION/MAINTENANCE)
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/apis/shared/tickets.api'
import { Button, Card } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { TicketSatChecklist } from '@/types'
import { SAT_ITEMS } from './ticketHelpers'
// SAT_ITEMS được xuất từ ticketHelpers — nguồn sự thật duy nhất, không khai báo trùng với Step6SAT

interface Props {
  ticketId: string
  checklist: TicketSatChecklist
}

export function SATChecklist({ ticketId, checklist }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<TicketSatChecklist>({ ...checklist })

  const toggleMut = useMutation({
    mutationFn: (updates: Partial<TicketSatChecklist>) =>
      ticketApi.updateSatChecklist(ticketId, updates),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    onError: (err) => push(getApiErrorMessage(err, 'Cập nhật checklist thất bại'), 'error'),
  })

  const completeMut = useMutation({
    mutationFn: () =>
      ticketApi.updateStatus(ticketId, 'CLOSED', 'Kỹ thuật viên hoàn tất SAT checklist.'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Đã đóng ticket thành công. Vui lòng thông báo cho Farm Owner.')
    },
    onError: (err) => push(getApiErrorMessage(err, 'Hoàn thành thất bại'), 'error'),
  })

  function toggle(key: keyof TicketSatChecklist) {
    const prevState = local[key]           // lưu state cũ trước khi optimistic update
    const next = { ...local, [key]: !local[key] }
    setLocal(next)                         // optimistic update ngay
    toggleMut.mutate({ [key]: next[key] }, {
      onError: () => {
        // Rollback nếu API thất bại
        setLocal(prev => ({ ...prev, [key]: prevState }))
      },
    })
  }

  const checkedCount = Object.values(local).filter(Boolean).length
  const allDone = checkedCount === SAT_ITEMS.length

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between">
        <p className="label-caption">NGHIỆM THU (SAT CHECKLIST)</p>
        <span className={`text-sm font-semibold ${allDone ? 'text-limeMist' : 'text-warmGray'}`}>
          {checkedCount}/{SAT_ITEMS.length} mục đã xác nhận
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {SAT_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => toggle(item.key)}
            className={`flex items-center gap-3.5 rounded-xl border-2 p-3.5 text-left transition-colors ${
              local[item.key]
                ? 'border-charcoal/30 bg-charcoal/5'
                : 'border-graphite/15 hover:border-graphite/30'
            }`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
              local[item.key] ? 'border-charcoal bg-charcoal text-white' : 'border-graphite/40'
            }`}>
              {local[item.key] ? '✓' : ''}
            </span>
            <div>
              <p className="font-semibold text-charcoal">{item.label}</p>
              <p className="text-sm text-warmGray">{item.subLabel}</p>
            </div>
          </button>
        ))}
      </div>

      <Button
        onClick={() => completeMut.mutate()}
        loading={completeMut.isPending}
        disabled={!allDone}
        className="mt-4 w-full justify-center"
        title={allDone ? '' : 'Cần xác nhận đủ 4/4 mục trước khi hoàn thành'}
      >
        Hoàn thành & Đóng ticket
      </Button>
    </Card>
  )
}
