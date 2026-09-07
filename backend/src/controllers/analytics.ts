import { Response } from 'express'
import type { AuthRequest } from '@/types'

export async function birdCountDaily(req: AuthRequest, res: Response): Promise<void>       { res.status(501).json({ error: 'Not implemented yet' }) }
export async function birdCountTrends(req: AuthRequest, res: Response): Promise<void>      { res.status(501).json({ error: 'Not implemented yet' }) }
export async function envBirdCorrelation(req: AuthRequest, res: Response): Promise<void>   { res.status(501).json({ error: 'Not implemented yet' }) }
