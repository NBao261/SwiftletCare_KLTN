/**
 * OPS-FR-006, ALERT-FR-016 — kế hoạch bảo trì đến hạn mở `MAINTENANCE_DUE` và Work Order phòng ngừa; còn đến hạn quá
 * maintenance_grace_days thì OVERDUE, báo Farm Owner. Mỗi giờ (phút 10, sau relayUsage.job cộng dồn giờ chạy lúc phút
 * 0) cho kế hoạch theo giờ chạy và số lần đóng cắt; 07:00 giờ Việt Nam cho kế hoạch theo lịch (Report 3 OPS-FR-006).
 */
import cron from 'node-cron'
import { checkDuePlans } from '@/services/maintenance.service'
import logger from '@/utils/logger.util'

const HOURLY = '0 10 * * * *'
const CALENDAR_DAILY = '0 0 7 * * *'

function run(calendar: boolean): void {
  checkDuePlans(new Date(), { calendar })
    .then(({ opened, overdue }) => {
      if (opened + overdue > 0) logger.info('Kế hoạch bảo trì đến hạn (OPS-FR-006)', { calendar, opened, overdue })
    })
    .catch((err: Error) => logger.error('maintenanceDue.job failed', { calendar, err }))
}

export function startMaintenanceDueJob(): void {
  cron.schedule(HOURLY, () => run(false))
  cron.schedule(CALENDAR_DAILY, () => run(true), { timezone: 'Asia/Ho_Chi_Minh' })
}
