import { Request, Response } from 'express'
import { readSourceForDevice } from '@/services/cameraSource.service'
import { enrollWithSetupCode } from '@/services/provisionedDevice.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

// Nút AI đổi mã cài đặt lấy danh tính (mật khẩu broker chỉ trả một lần, không lưu ở đâu khác)
export const enroll = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true, data: await enrollWithSetupCode(req.body.setup_code as string) })
})

// Địa chỉ camera có mật khẩu: không cho proxy hay trình duyệt giữ lại
export const cameraSource = asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true, data: await readSourceForDevice(req.headers.authorization) })
})
