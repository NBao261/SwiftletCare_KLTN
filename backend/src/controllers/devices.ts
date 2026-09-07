import { Request, Response } from 'express'
import type { AuthRequest } from '@/types'

export async function registerSensorNode(req: AuthRequest, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listSensorNodes(req: AuthRequest, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getSensorNode(req: AuthRequest, res: Response): Promise<void>      { res.status(501).json({ error: 'Not implemented yet' }) }
export async function updateThresholds(req: AuthRequest, res: Response): Promise<void>   { res.status(501).json({ error: 'Not implemented yet' }) }
export async function controlRelay(req: AuthRequest, res: Response): Promise<void>       { res.status(501).json({ error: 'Not implemented yet' }) }
export async function registerCameraNode(req: AuthRequest, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listCameraNodes(req: AuthRequest, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
