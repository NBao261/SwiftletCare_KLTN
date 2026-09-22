// Step6SAT.tsx — Bước 6: Nghiệm thu SAT Checklist + hoàn tất (B7)
// Fix toast: nếu không có ticketId (vào từ nav, không từ ticket) thì
// không thông báo sai "đã báo Farm Owner" khi chưa có API nào được gọi.
// Fix SAT_ITEMS: import từ ticketHelpers thay vì khai báo trùng.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Button } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import type { TicketSatChecklist } from '@/types'
import type { OnboardingState } from './onboardingTypes'
import { SAT_ITEMS } from '../../Tickets/components/ticketHelpers'
// SAT_ITEMS nguồn sự thật từ ticketHelpers — cả SATChecklist và Step6SAT dùng chung

interface Props {
  data: OnboardingState
  onDone: (ticketId?: string) => void
}

export function Step6SAT({ data, onDone }: Props) {
  const push = useToastStore(s => s.push)
  const [sat, setSat] = useState<TicketSatChecklist>({
    modbus_addresses_ok: false,
    camera_rtsp_ok:      false,
    lte_connection_ok:   false,
    relay_test_ok:       false,
  })

  const isCameraNode = data.deviceType === 'CAMERA_NODE'
  const activeItems  = SAT_ITEMS.filter(item => isCameraNode || !item.cameraOnly)
  const checkedCount = activeItems.filter(item => sat[item.key]).length
  const allDone      = checkedCount === activeItems.length

  const completeMut = useMutation({
    mutationFn: async () => {
      // data.ticketId là ID của Ticket INSTALLATION liên kết với lần onboard này.
      // Được truyền từ URL query ?ticketId=... khi Technician vào Onboarding từ màn hình Ticket.
      // Nếu không có (onboard thủ công từ nav, không từ ticket), bỏ qua API call.
      //
      // FIX: dùng data.ticketId (ticket _id) — KHÔNG phải data.deviceDbId (SensorNode _id).
      // ticketApi.updateSatChecklist(ticketId, sat) cần ticket ID để patch SAT fields trên ticket.
      if (!data.ticketId) return
      await ticketApi.updateSatChecklist(data.ticketId, sat)
    },
    onSuccess: () => {
      // Fix: không nói "Đã báo Farm Owner" nếu không có ticketId — Farm Owner chưa được thông báo gì
      if (data.ticketId) {
        push('🎉 Lắp đặt hoàn tất! Farm Owner đã được thông báo.')
      } else {
        push('Onboarding hoàn tất. Vào ticket INSTALLATION để cập nhật SAT checklist.')
      }
      onDone(data.ticketId || undefined)
    },
    onError: (err) => push(getApiErrorMessage(err, 'Hoàn thành thất bại'), 'error'),
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-xl border border-limeMist/30 bg-limeMist/15 px-5 py-4">
        <span className="text-3xl">✅</span>
        <div>
          <p className="font-bold text-charcoal">Thiết bị đã kết nối thành công!</p>
          <p className="text-sm text-charcoal/70">ID: {data.deviceId} · Zone đã gán</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-charcoal">Bước 6 — Nghiệm thu (SAT Checklist)</h2>
        <p className="mt-1 text-sm text-warmGray">Xác nhận từng hạng mục trước khi hoàn tất bàn giao.</p>
      </div>

      {/* SAT items */}
      <div className="flex flex-col gap-2.5">
        {activeItems.map(item => (
          <button
            key={item.key}
            onClick={() => setSat(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
            className={`flex items-center gap-3.5 rounded-xl border-2 p-4 text-left transition-colors ${
              sat[item.key]
                ? 'border-charcoal/30 bg-charcoal/5'
                : 'border-graphite/15 hover:border-graphite/30'
            }`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
              sat[item.key] ? 'border-charcoal bg-charcoal text-white' : 'border-graphite/40 text-transparent'
            }`}>
              ✓
            </span>
            <div>
              <p className="font-semibold text-charcoal">{item.label}</p>
              <p className="text-sm text-warmGray">{item.subLabel}</p>
            </div>
          </button>
        ))}
      </div>

      <p className={`text-center text-sm font-semibold ${allDone ? 'text-limeMist' : 'text-warmGray'}`}>
        {checkedCount}/{activeItems.length} mục đã xác nhận
      </p>

      <Button
        onClick={() => completeMut.mutate()}
        loading={completeMut.isPending}
        disabled={!allDone}
        className="w-full justify-center"
        title={allDone ? '' : `Cần xác nhận đủ ${activeItems.length}/${activeItems.length} mục`}
      >
        🎉 Hoàn thành & Đóng ticket
      </Button>
    </div>
  )
}
