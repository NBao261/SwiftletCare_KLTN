/** npm run job:run -- <health|recommendations|effects|expire|maintenance|relay-usage|recovery|escalation> [tham số] */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '@/config/db.config'
import { addDays, assessAllHouses } from '@/services/healthAssessment.service'
import { vnDate } from '@/services/birdCount.service'
import { evaluateRecommendationRules, expireRecommendations, measureRecommendationEffects } from '@/services/recommendation.service'
import { checkDuePlans } from '@/services/maintenance.service'
import { accumulateRelayUsage } from '@/services/relayUsage.service'
import { verifyWorkOrders } from '@/services/workOrder.service'
import { escalateUnacknowledgedAlerts } from '@/services/alertRouting.service'
import logger from '@/utils/logger.util'

const DAY_MS = 86_400_000
const [job, arg] = process.argv.slice(2)
const yesterday = () => addDays(vnDate(new Date()), -1)
const isDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

const JOBS: Record<string, () => Promise<unknown>> = {
  health: () => assessAllHouses(isDate(arg) ? arg : yesterday()),
  recommendations: () => evaluateRecommendationRules(isDate(arg) ? arg : yesterday()),
  effects: () => measureRecommendationEffects(),
  expire: () => expireRecommendations(new Date(Date.now() + (Number(arg) || 0) * DAY_MS)),
  maintenance: async () => ({ counted: await checkDuePlans(), calendar: await checkDuePlans(new Date(), { calendar: true }) }),
  'relay-usage': () => accumulateRelayUsage(),
  recovery: () => verifyWorkOrders(),
  escalation: () => escalateUnacknowledgedAlerts(),
}

async function main(): Promise<void> {
  const run = JOBS[job]
  if (!run) throw new Error(`Job không có: "${job ?? ''}". Chọn một trong: ${Object.keys(JOBS).join(', ')}`)
  await connectDB()
  logger.info(`[job:run] ${job}`, { result: await run() })
  await mongoose.disconnect()
}

main().catch(async (err: Error) => {
  logger.error('[job:run] Failed', { err: err.message })
  await mongoose.disconnect()
  process.exit(1)
})
