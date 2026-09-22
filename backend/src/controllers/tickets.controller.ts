import { Request, Response } from 'express'
import * as ticketService from '@/services/ticket.service'
import { asyncHandler } from '@/utils/asyncHandler.util'
import type { TicketStatus } from '@/types'

/** POST /tickets – TICKET-FR-001 (báo lỗi + yêu cầu lắp đặt, Flow 9/9b) */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.createTicket(req.user, req.body)
  res.status(201).json({ success: true, data: ticket })
})

/** GET /tickets */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await ticketService.listTickets(req.user, {
    farmId:       req.query.farmId as string | undefined,
    status:       req.query.status as string | undefined,
    priority:     req.query.priority as string | undefined,
    assignedToMe: req.query.assignedToMe === 'true',
    unassigned:   req.query.unassigned === 'true',
    page:         req.query.page ? Number(req.query.page) : undefined,
    limit:        req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** GET /tickets/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.getTicket(req.params.id, req.user)
  res.json({ success: true, data: ticket })
})

/** PUT /tickets/:id/status – TICKET-FR-007/010 */
export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.updateStatus(
    req.params.id, req.user, req.body.status as TicketStatus, req.body.note as string | undefined,
  )
  res.json({ success: true, data: ticket })
})

/** PUT /tickets/:id/scheduled-date – TICKET-FR-004b (Technician tự dời lịch hẹn) */
export const reschedule = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.rescheduleVisit(
    req.params.id, req.user, req.body.scheduled_visit_at as string, req.body.reason as string,
  )
  res.json({ success: true, data: ticket })
})

/** POST /tickets/:id/reassign-request – Flow 9 case 4a */
export const requestReassign = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.requestReassign(req.params.id, req.user, req.body.reason as string)
  res.json({ success: true, data: ticket })
})

/** PUT /tickets/:id/cancel – Flow 9 case 6c (Farm Owner tự huỷ) */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.cancelTicket(req.params.id, req.user, req.body.reason as string)
  res.json({ success: true, data: ticket })
})

/** POST /tickets/:id/notes */
export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.addNote(req.params.id, req.user, req.body.content as string)
  res.status(201).json({ success: true, data: ticket })
})

/** PUT /tickets/:id/sat-checklist – TICKET-FR-010 */
export const updateSatChecklist = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.updateSatChecklist(req.params.id, req.user, req.body)
  res.json({ success: true, data: ticket })
})

/** POST /tickets/:id/escalate – TICKET-FR-009 */
export const escalate = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.escalateTicket(req.params.id, req.user, req.body.reason as string | undefined)
  res.json({ success: true, data: ticket })
})

/** POST /tickets/:id/rating – TICKET-FR-011 */
export const rate = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.rateTicket(req.params.id, req.user, Number(req.body.satisfaction_rating))
  res.json({ success: true, data: ticket })
})

/** GET /tickets/kpi – TICKET-FR-012 */
export const kpi = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await ticketService.getKpi() })
})

/** PUT /tickets/:id/admin-override – TICKET-FR-005b */
export const adminOverride = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await ticketService.adminOverrideTicket(req.params.id, req.user, req.body)
  res.json({ success: true, data: ticket })
})
