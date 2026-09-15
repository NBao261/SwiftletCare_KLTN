import { Request, Response } from 'express'
import { notImplemented } from '@/utils/notImplemented'

// TODO: Implement in TASK-M3 sprint — di chuyển logic vào 1 service riêng (vd analyticsService.ts) khi code
export async function birdCountDaily(_req: Request, res: Response): Promise<void>     { notImplemented(res) }
export async function birdCountTrends(_req: Request, res: Response): Promise<void>    { notImplemented(res) }
export async function envBirdCorrelation(_req: Request, res: Response): Promise<void> { notImplemented(res) }
