// Phút 10 mỗi giờ (sau relayUsage.job) cho kế hoạch theo giờ chạy; 07:00 cho kế hoạch theo lịch
import cron from 'node-cron'
import { checkDuePlans } from '@/services/maintenance.service'
import logger from '@/utils/logger.util'

const HOURLY = '0 10 * * * *'
const CALENDAR_DAILY = '0 0 7 * * *'

function run(calendar: boolean): void {
  checkDuePlans(new Date(), { calendar })
    .then(({ opened, overdue, reminded }) => {
      if (opened + overdue + reminded > 0) logger.info('Kế hoạch bảo trì đến hạn (OPS-FR-006)', { calendar, opened, overdue, reminded })
    })
    .catch((err: Error) => logger.error('maintenanceDue.job failed', { calendar, err }))
}

export function startMaintenanceDueJob(): void {
  cron.schedule(HOURLY, () => run(false))
  cron.schedule(CALENDAR_DAILY, () => run(true), { timezone: 'Asia/Ho_Chi_Minh' })
}
