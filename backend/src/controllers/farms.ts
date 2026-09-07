import { Request, Response } from 'express'
import type { AuthRequest } from '@/types'

export async function list(req: AuthRequest, res: Response): Promise<void>          { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getOne(req: AuthRequest, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function create(req: AuthRequest, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function update(req: AuthRequest, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function remove(req: AuthRequest, res: Response): Promise<void>        { res.status(501).json({ error: 'Not implemented yet' }) }
export async function inviteMember(req: AuthRequest, res: Response): Promise<void>  { res.status(501).json({ error: 'Not implemented yet' }) }
export async function createHouse(req: AuthRequest, res: Response): Promise<void>   { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listHouses(req: AuthRequest, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function createZone(req: AuthRequest, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listZones(req: AuthRequest, res: Response): Promise<void>     { res.status(501).json({ error: 'Not implemented yet' }) }
export async function updateThresholds(req: AuthRequest, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
