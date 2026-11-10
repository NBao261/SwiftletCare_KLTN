import { Request, Response } from 'express'
import { asyncHandler } from '@/utils/asyncHandler.util'
import { authorizeBrokerClient } from '@/services/mqttAuth.service'

/** POST /internal/mqtt-auth?key= — EMQX xác thực thiết bị và service account */
export const mqttAuth = asyncHandler(async (req: Request, res: Response) => {
  res.json({ result: await authorizeBrokerClient(req.query.key, req.body), is_superuser: false })
})
