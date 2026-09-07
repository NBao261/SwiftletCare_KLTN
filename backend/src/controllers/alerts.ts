import { Response } from 'express'
import type { AuthRequest } from '@/types'

export async function list(req: AuthRequest, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getOne(req: AuthRequest, res: Response): Promise<void>      { res.status(501).json({ error: 'Not implemented yet' }) }
export async function acknowledge(req: AuthRequest, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
