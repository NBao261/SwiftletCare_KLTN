import { Request, Response } from 'express'

// TODO: Implement in Giai đoạn 2 (Module SALES, §5.10) — stretch, not MVP scope
export async function create(_req: Request, res: Response): Promise<void>          { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getByCode(_req: Request, res: Response): Promise<void>       { res.status(501).json({ error: 'Not implemented yet' }) }
export async function list(_req: Request, res: Response): Promise<void>            { res.status(501).json({ error: 'Not implemented yet' }) }
export async function confirm(_req: Request, res: Response): Promise<void>         { res.status(501).json({ error: 'Not implemented yet' }) }
export async function updateStatus(_req: Request, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function createReturnRequest(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
