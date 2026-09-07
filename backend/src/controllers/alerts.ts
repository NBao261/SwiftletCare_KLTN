import { Request, Response } from 'express'

export async function list(_req: Request, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getOne(_req: Request, res: Response): Promise<void>      { res.status(501).json({ error: 'Not implemented yet' }) }
export async function acknowledge(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
