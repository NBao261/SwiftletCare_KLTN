// 15 phút sau khung chiều của từng nhà
import cron from 'node-cron'
import { checkReturnRateDrops, claimDueHouses, computeHouseSessions } from '@/services/birdCount.service'
import { assessAllHouses } from '@/services/healthAssessment.service'
import { generateDailyReports } from '@/services/houseHealthReport.service'
import { evaluateRecommendationRules } from '@/services/recommendation.service'
import logger from '@/utils/logger.util'

// Quét 5 phút nên trễ tối đa 5 phút
const CRON_EXPRESSION = '0 */5 * * * *'

// Bước sau vẫn chạy khi bước trước lỗi
async function step(name: string, run: () => Promise<number>): Promise<void> {
  try {
    const count = await run()
    if (count > 0) logger.info(`${name}: ${count}`)
  } catch (err) {
    logger.error(`${name} failed`, { err })
  }
}

export async function runEveningChecks(now = new Date()): Promise<void> {
  const { date, houseIds } = await claimDueHouses(now)
  if (houseIds.length === 0) return
  for (const houseId of houseIds) {
    try {
      await computeHouseSessions(houseId, date, now)
    } catch (err) {
      logger.error('Tính phiên đếm thất bại', { houseId, date, err })
    }
  }
  await step('Cảnh báo LOW_RETURN_RATE mới (VISION-FR-011)', () => checkReturnRateDrops(date, houseIds))
  await step('Nhà yến đã đánh giá sức khỏe (ANALYTICS-FR-012)', () => assessAllHouses(date, now, houseIds))
  await step('Báo cáo ngày theo nhà (EXPERT-FR-005)', () => generateDailyReports(date, now, houseIds))
  await step('Khuyến nghị mới (EXPERT-FR-017)', () => evaluateRecommendationRules(date, now, houseIds))
}

export function startReturnRateJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    runEveningChecks().catch((err: Error) => logger.error('returnRate.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Evening checks scheduled every 5 min, per house after its evening window (BR-21)')
}
