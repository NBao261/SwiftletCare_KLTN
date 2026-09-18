import { Request, Response, NextFunction } from 'express'
import * as ticketService from '@/services/ticket.service'
import type { TicketStatus } from '@/types'

/** POST /tickets – TICKET-FR-001 (báo lỗi + yêu cầu lắp đặt, Flow 9/9b) */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.createTicket(req.user, req.body)
    res.status(201).json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** GET /tickets */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit } = await ticketService.listTickets(req.user, {
      farmId:       req.query.farmId as string | undefined,
      status:       req.query.status as string | undefined,
      priority:     req.query.priority as string | undefined,
      assignedToMe: req.query.assignedToMe === 'true',
      page:         req.query.page ? Number(req.query.page) : undefined,
      limit:        req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit } })
  } catch (err) { next(err) }
}

/** GET /tickets/:id */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.getTicket(req.params.id, req.user)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** PUT /tickets/:id/status – TICKET-FR-007/010 */
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.updateStatus(
      req.params.id, req.user, req.body.status as TicketStatus, req.body.note as string | undefined,
    )
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** PUT /tickets/:id/cancel – Flow 9 case 6c (Farm Owner tự huỷ) */
export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.cancelTicket(req.params.id, req.user, req.body.reason as string)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** POST /tickets/:id/notes */
export async function addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.addNote(req.params.id, req.user, req.body.content as string)
    res.status(201).json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** PUT /tickets/:id/sat-checklist – TICKET-FR-010 */
export async function updateSatChecklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.updateSatChecklist(req.params.id, req.user, req.body)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** POST /tickets/:id/escalate – TICKET-FR-009 */
export async function escalate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.escalateTicket(req.params.id, req.user, req.body.reason as string | undefined)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** POST /tickets/:id/rating – TICKET-FR-011 */
export async function rate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.rateTicket(req.params.id, req.user, Number(req.body.satisfaction_rating))
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}

/** GET /tickets/kpi – TICKET-FR-012 */
export async function kpi(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await ticketService.getKpi() })
  } catch (err) { next(err) }
}

/** PUT /tickets/:id/admin-override – TICKET-FR-005b */
export async function adminOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ticket = await ticketService.adminOverrideTicket(req.params.id, req.user, req.body)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
}
