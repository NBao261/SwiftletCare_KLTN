import { Request, Response } from 'express'

export async function birdCountDaily(_req: Request, res: Response): Promise<void>     { res.status(501).json({ error: 'Not implemented yet' }) }
export async function birdCountTrends(_req: Request, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function envBirdCorrelation(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
