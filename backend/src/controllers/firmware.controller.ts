import { Request, Response } from 'express'
import { readOtaDownload } from '@/services/firmwareRollout.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

// Nhị phân, không bọc envelope; chip cần Content-Length để biết đã tải đủ
export const downloadOtaFirmware = asyncHandler(async (req: Request, res: Response) => {
  const firmware = await readOtaDownload(req.params.token)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', String(firmware.length))
  res.end(firmware)
})
