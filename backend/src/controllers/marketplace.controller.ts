import { Request, Response } from 'express'
import { notImplemented } from '@/utils/notImplemented.util'

// TODO: Implement in TASK-M3 sprint (MARKET-FR-006..013) — di chuyển logic vào services/market.service.ts khi code
export async function createListing(_req: Request, res: Response): Promise<void> { notImplemented(res) }
export async function listPublic(_req: Request, res: Response): Promise<void>     { notImplemented(res) }
export async function getOne(_req: Request, res: Response): Promise<void>         { notImplemented(res) }
export async function updateListing(_req: Request, res: Response): Promise<void>  { notImplemented(res) }
export async function traceByCode(_req: Request, res: Response): Promise<void>    { notImplemented(res) }
export async function createInquiry(_req: Request, res: Response): Promise<void>  { notImplemented(res) }
export async function listInquiries(_req: Request, res: Response): Promise<void>  { notImplemented(res) }
export async function listingStats(_req: Request, res: Response): Promise<void>   { notImplemented(res) }
export async function farmProfile(_req: Request, res: Response): Promise<void>    { notImplemented(res) }
