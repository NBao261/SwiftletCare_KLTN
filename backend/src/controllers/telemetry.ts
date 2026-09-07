import { Request, Response } from 'express'
import type { AuthRequest } from '@/types'

export async function getLatest(req: AuthRequest, res: Response): Promise<void>  { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getHistory(req: AuthRequest, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
