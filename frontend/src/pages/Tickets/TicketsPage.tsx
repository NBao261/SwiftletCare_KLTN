// Tickets Page – TICKET-FR-001..004b/006/007
import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useZoneStore } from '@/store/zoneStore'
import { usePermission } from '@/hooks/usePermission'
import { useTicketsList, useCreateTicket } from '@/hooks/useTickets'
import { Button, Modal, Select, Textarea, Badge, Card } from '@/components/ui'
import ZonePicker, { type ZonePickerValue } from '@/components/common/ZonePicker'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import FilterChip from '@/components/common/FilterChip'
import { IconTicket } from '@/components/ui/icons'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import type { TicketType, TicketStatus } from '@/types'
import type { CreateTicketInput } from '@/services/api/tickets'

const INSTALLATION_TYPES: TicketType[] = ['INSTALLATION', 'MAINTENANCE']

export default function TicketsPage() {
  const [status, setStatus] = useState<TicketStatus | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()
  // Backend: POST /tickets chỉ cho FARM_OWNER, ADMIN
  const canCreate = usePermission('FARM_OWNER', 'ADMIN')

  const { records, total, limit, isLoading } = useTicketsList({ status, page, limit: 10 })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={status === undefined} label="Tất cả" onClick={() => { setStatus(undefined); setPage(1) }} />
          {(Object.keys(STATUS_LABEL) as TicketStatus[]).map(s => (
            <FilterChip key={s} active={status === s} label={STATUS_LABEL[s]} onClick={() => { setStatus(s); setPage(1) }} />
          ))}
        </div>
        {canCreate && <Button onClick={() => setShowCreate(true)}>+ Tạo ticket</Button>}
      </div>

      {isLoading && <LoadingSkeleton count={3} className="h-20 w-full" />}

      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title="Không có ticket nào"
          description="Tạo ticket khi gặp sự cố kỹ thuật hoặc cần yêu cầu lắp đặt/bảo trì thiết bị."
          action={canCreate ? <Button onClick={() => setShowCreate(true)}>+ Tạo ticket</Button> : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        {records.map(ticket => (
          <Card key={ticket._id} className="cursor-pointer transition-shadow hover:shadow-dock" onClick={() => navigate(`/tickets/${ticket._id}`)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
                  <p className="font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</p>
                </div>
                {ticket.notes[0] && <p className="mt-1 truncate text-sm text-warmGray">{ticket.notes[0].content}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                <span className="text-xs text-warmGray">{formatDate(ticket.created_at)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <CreateTicketModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreateTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedFarmId, selectedZoneId } = useZoneStore()
  const createTicket = useCreateTicket()
  const push = useToastStore(s => s.push)

  const [zone, setZone] = useState<Partial<ZonePickerValue>>({ farmId: selectedFarmId ?? undefined, zoneId: selectedZoneId ?? undefined })
  const [type, setType] = useState<TicketType>('OTHER')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Modal không unmount giữa các lần mở (chỉ toggle `open`) — resync theo
  // ZoneSwitcher mỗi lần mở lại, tránh prefill nhầm zone cũ đã đổi ở TopBar.
  useEffect(() => {
    if (open) setZone({ farmId: selectedFarmId ?? undefined, zoneId: selectedZoneId ?? undefined })
  }, [open, selectedFarmId, selectedZoneId])

  const needsSchedule = INSTALLATION_TYPES.includes(type)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!zone.farmId) return
    const input: CreateTicketInput = {
      farm_id: zone.farmId,
      zone_id: zone.zoneId,
      type,
      description: description || undefined,
      scheduled_visit_at: needsSchedule ? new Date(scheduledAt).toISOString() : undefined,
    }
    createTicket.mutate(input, {
      onSuccess: () => { push('Đã tạo ticket'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Tạo ticket thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Loại ticket" value={type} onChange={e => setType(e.target.value as TicketType)}>
          {Object.entries(TICKET_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>

        <ZonePicker value={zone} onChange={setZone} zoneRequired={false} />

        {needsSchedule && (
          <div className="flex flex-col gap-1.5">
            <label className="label-caption">Ngày giờ hẹn mong muốn</label>
            <input
              type="datetime-local" required
              value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="input"
            />
          </div>
        )}

        <Textarea label="Mô tả (tùy chọn)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả tình trạng sự cố hoặc yêu cầu cụ thể..." />

        <Button type="submit" loading={createTicket.isPending} disabled={!zone.farmId} className="w-full">
          Tạo ticket
        </Button>
      </form>
    </Modal>
  )
}
