/**
 * BR-21, VISION-FR-008, 011, 020 — kiểm tra buổi tối theo từng nhà: 15 phút sau khung chiều của chính nhà đó hôm nay
 * (lịch đếm VISION-FR-019, mặc định 19:00 nên 19:15), tính hai phiên từ số 5 phút, so tỷ lệ chim về, rồi đánh giá ngày,
 * báo cáo ngày và luật khuyến nghị của các nhà đó.
 */
import cron from 'node-cron'
import { checkReturnRateDrops, claimDueHouses, computeHouseSessions } from '@/services/birdCount.service'
import { assessAllHouses } from '@/services/healthAssessment.service'
import { generateDailyReports } from '@/services/houseHealthReport.service'
import { evaluateRecommendationRules } from '@/services/recommendation.service'
import logger from '@/utils/logger.util'

/** ponytail: quét 5 phút một lần nên kiểm tra trễ tối đa 5 phút so với giờ của nhà; quét dày hơn nếu cần đúng phút */
const CRON_EXPRESSION = '0 */5 * * * *'

/** Mỗi bước chạy kể cả khi bước trước lỗi: đánh giá ngày vẫn cần có khi kiểm tỷ lệ lỗi */
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
  // ANALYTICS-FR-012 — đánh giá sức khỏe ngày sau kiểm tra tỷ lệ chim về (BR-21)
  await step('Nhà yến đã đánh giá sức khỏe (ANALYTICS-FR-012)', () => assessAllHouses(date, now, houseIds))
  // EXPERT-FR-005, BR-33 — báo cáo ngày theo nhà ngay sau đánh giá ngày
  await step('Báo cáo ngày theo nhà (EXPERT-FR-005)', () => generateDailyReports(date, now, houseIds))
  // EXPERT-FR-017, BR-42 — luật khuyến nghị xét sau đánh giá ngày
  await step('Khuyến nghị mới (EXPERT-FR-017)', () => evaluateRecommendationRules(date, now, houseIds))
}

export function startReturnRateJob(): void {
  cron.schedule(CRON_EXPRESSION, () => {
    runEveningChecks().catch((err: Error) => logger.error('returnRate.job failed', { err }))
  }, { timezone: 'Asia/Ho_Chi_Minh' })
  logger.info('Evening checks scheduled every 5 min, per house after its evening window (BR-21)')
}
