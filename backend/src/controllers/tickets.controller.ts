import { Request, Response } from 'express'
import { notImplemented } from '@/utils/notImplemented.util'

// TODO: Implement in TASK-M3 sprint (Module TICKET, §5.9) — di chuyển logic vào services/ticket.service.ts khi code
export async function create(_req: Request, res: Response): Promise<void>         { notImplemented(res) }
export async function list(_req: Request, res: Response): Promise<void>           { notImplemented(res) }
export async function getOne(_req: Request, res: Response): Promise<void>         { notImplemented(res) }
export async function updateStatus(_req: Request, res: Response): Promise<void>   { notImplemented(res) }
export async function addNote(_req: Request, res: Response): Promise<void>        { notImplemented(res) }
export async function updateSatChecklist(_req: Request, res: Response): Promise<void> { notImplemented(res) }
export async function escalate(_req: Request, res: Response): Promise<void>       { notImplemented(res) }
export async function rate(_req: Request, res: Response): Promise<void>           { notImplemented(res) }
export async function kpi(_req: Request, res: Response): Promise<void>            { notImplemented(res) }
