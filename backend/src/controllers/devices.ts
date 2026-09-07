import { Request, Response } from 'express'

export async function registerSensorNode(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listSensorNodes(_req: Request, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
export async function getSensorNode(_req: Request, res: Response): Promise<void>      { res.status(501).json({ error: 'Not implemented yet' }) }
export async function updateThresholds(_req: Request, res: Response): Promise<void>   { res.status(501).json({ error: 'Not implemented yet' }) }
export async function controlRelay(_req: Request, res: Response): Promise<void>       { res.status(501).json({ error: 'Not implemented yet' }) }
export async function registerCameraNode(_req: Request, res: Response): Promise<void> { res.status(501).json({ error: 'Not implemented yet' }) }
export async function listCameraNodes(_req: Request, res: Response): Promise<void>    { res.status(501).json({ error: 'Not implemented yet' }) }
