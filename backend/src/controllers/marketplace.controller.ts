import { Request, Response } from 'express'
import * as marketService from '@/services/market.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

/** GET /marketplace/listings – MARKET-FR-008 (công khai) */
export const listPublic = asyncHandler(async (req: Request, res: Response) => {
  const { records, total, page, limit } = await marketService.listPublicListings({
    nestType: req.query.nestType as string | undefined,
    region:   req.query.region as string | undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    page:     req.query.page ? Number(req.query.page) : undefined,
    limit:    req.query.limit ? Number(req.query.limit) : undefined,
  })
  res.json({ success: true, data: records, meta: { total, page, limit } })
})

/** GET /marketplace/listings/:id – MARKET-FR-009 Traceability Card (công khai) */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await marketService.getListingDetail(req.params.id) })
})

/** GET /marketplace/trace/:traceCode – MARKET-FR-011 (công khai, quét QR trên bao bì) */
export const traceByCode = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await marketService.traceByCode(req.params.traceCode) })
})

/** POST /marketplace/listings/:id/inquiries – MARKET-FR-010 (Buyer, không cần tài khoản) */
export const createInquiry = asyncHandler(async (req: Request, res: Response) => {
  const inquiry = await marketService.createInquiry(req.params.id, req.body)
  res.status(201).json({ success: true, data: inquiry })
})

/** GET /marketplace/farms/:id/profile – MARKET-FR-013 (công khai) */
export const farmProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await marketService.getFarmProfile(req.params.id) })
})

/** POST /marketplace/listings – MARKET-FR-006 (Farm Owner) */
export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await marketService.createListing(req.user, req.body)
  res.status(201).json({ success: true, data: listing })
})

/** PUT /marketplace/listings/:id (Farm Owner) */
export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await marketService.updateListing(req.params.id, req.user, req.body)
  res.json({ success: true, data: listing })
})

/** GET /marketplace/listings/:id/inquiries (Farm Owner) */
export const listInquiries = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await marketService.listInquiries(req.params.id, req.user) })
})

/** GET /marketplace/listings/:id/stats – MARKET-FR-012 (Farm Owner) */
export const listingStats = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await marketService.getListingStats(req.params.id, req.user) })
})
