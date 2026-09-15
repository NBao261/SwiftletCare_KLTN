import { Request, Response } from 'express'
import { notImplemented } from '@/utils/notImplemented.util'

// TODO: Implement in TASK-M3 sprint — di chuyển logic vào services/alert.service.ts khi code
export async function list(_req: Request, res: Response): Promise<void>        { notImplemented(res) }
export async function getOne(_req: Request, res: Response): Promise<void>      { notImplemented(res) }
export async function acknowledge(_req: Request, res: Response): Promise<void> { notImplemented(res) }
