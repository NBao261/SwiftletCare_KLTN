import { Request, Response } from 'express'
import { asyncHandler } from '@/utils/asyncHandler.util'
import { authorizeBrokerClient } from '@/services/mqttAuth.service'

export const mqttAuth = asyncHandler(async (req: Request, res: Response) => {
  res.json({ result: await authorizeBrokerClient(req.query.key, req.body), is_superuser: false })
})
