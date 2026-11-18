/**
 * Chạy một job nền ngay một lần, thay cho việc chờ lịch của nó, cho các bước "chạy job" của kịch bản demo
 * (Design Brief Phụ lục A2, docs/deploy/staging.md §5). Gọi đúng hàm mà job theo lịch gọi.
 *
 *   npm run job:run -- health [YYYY-MM-DD]          # đánh giá ngày (mặc định hôm qua), như returnRate.job
 *   npm run job:run -- recommendations [YYYY-MM-DD] # xét luật khuyến nghị (mặc định hôm qua)
 *   npm run job:run -- effects                      # đo hiệu quả khuyến nghị đã chấp nhận
 *   npm run job:run -- expire [số ngày tới]         # hết hạn khuyến nghị, như thể đã qua thêm N ngày (DS-16)
 *   npm run job:run -- maintenance                  # kế hoạch bảo trì đến hạn và quá hạn (cả kế hoạch theo lịch)
 *   npm run job:run -- relay-usage                  # cộng giờ chạy bơm, quạt từ telemetry
 *   npm run job:run -- recovery                     # kiểm phục hồi Work Order
 *   npm run job:run -- escalation                   # leo thang cảnh báo thợ chưa xác nhận
 */
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
