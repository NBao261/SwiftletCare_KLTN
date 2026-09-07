import { Request, Response } from 'express'

export async function getLatest(_req: Request, res: Response): Promise<void>  { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getHistory(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
