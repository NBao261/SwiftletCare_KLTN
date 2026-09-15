import { Request, Response } from 'express'
import { notImplemented } from '@/utils/notImplemented'

// TODO: Implement in TASK-M3 sprint — di chuyển logic vào services/alertService.ts khi code
export async function list(_req: Request, res: Response): Promise<void>        { notImplemented(res) }
export async function getOne(_req: Request, res: Response): Promise<void>      { notImplemented(res) }
export async function acknowledge(_req: Request, res: Response): Promise<void> { notImplemented(res) }
