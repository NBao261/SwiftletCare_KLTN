import { Request, Response, NextFunction } from 'express'
import * as marketService from '@/services/market.service'

/** GET /marketplace/listings – MARKET-FR-008 (công khai) */
export async function listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total, page, limit } = await marketService.listPublicListings({
      nestType: req.query.nestType as string | undefined,
      region:   req.query.region as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      page:     req.query.page ? Number(req.query.page) : undefined,
      limit:    req.query.limit ? Number(req.query.limit) : undefined,
    })
    res.json({ success: true, data: records, meta: { total, page, limit } })
  } catch (err) { next(err) }
}

/** GET /marketplace/listings/:id – MARKET-FR-009 Traceability Card (công khai) */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await marketService.getListingDetail(req.params.id) })
  } catch (err) { next(err) }
}

/** GET /marketplace/trace/:traceCode – MARKET-FR-011 (công khai, quét QR trên bao bì) */
export async function traceByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await marketService.traceByCode(req.params.traceCode) })
  } catch (err) { next(err) }
}

/** POST /marketplace/listings/:id/inquiries – MARKET-FR-010 (Buyer, không cần tài khoản) */
export async function createInquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const inquiry = await marketService.createInquiry(req.params.id, req.body)
    res.status(201).json({ success: true, data: inquiry })
  } catch (err) { next(err) }
}

/** GET /marketplace/farms/:id/profile – MARKET-FR-013 (công khai) */
export async function farmProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await marketService.getFarmProfile(req.params.id) })
  } catch (err) { next(err) }
}

/** POST /marketplace/listings – MARKET-FR-006 (Farm Owner) */
export async function createListing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const listing = await marketService.createListing(req.user, req.body)
    res.status(201).json({ success: true, data: listing })
  } catch (err) { next(err) }
}

/** PUT /marketplace/listings/:id (Farm Owner) */
export async function updateListing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const listing = await marketService.updateListing(req.params.id, req.user, req.body)
    res.json({ success: true, data: listing })
  } catch (err) { next(err) }
}

/** GET /marketplace/listings/:id/inquiries (Farm Owner) */
export async function listInquiries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await marketService.listInquiries(req.params.id, req.user) })
  } catch (err) { next(err) }
}

/** GET /marketplace/listings/:id/stats – MARKET-FR-012 (Farm Owner) */
export async function listingStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await marketService.getListingStats(req.params.id, req.user) })
  } catch (err) { next(err) }
}
