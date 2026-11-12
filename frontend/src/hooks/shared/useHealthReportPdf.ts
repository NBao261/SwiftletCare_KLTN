import { useState } from 'react'

import { healthDayApi } from '@/apis/shared/healthDays.api'
import { downloadHealthReportPdf } from '@/components/common/healthReportPdf'
import { healthDict } from '@/constants/health.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useToastStore } from '@/stores/toastStore'
import type { HouseHealthReport } from '@/types'

// EXPERT-FR-013 — tải PDF của 1 báo cáo theo ngôn ngữ màn; từ danh sách thì đọc chi tiết trước (ngày che theo người xem, BR-31)
export function useHealthReportPdf() {
  const { t, date, dateTime, exact } = useTranslation(healthDict)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function download(reportOrId: HouseHealthReport | string): Promise<void> {
    const reportId = typeof reportOrId === 'string' ? reportOrId : reportOrId._id
    setDownloadingId(reportId)
    try {
      const report = typeof reportOrId === 'string'
        ? (await healthDayApi.getReport(reportOrId)).data.data
        : reportOrId
      await downloadHealthReportPdf(report, { t, date, dateTime, number: value => exact(value, 1) })
    } catch (error) {
      push(apiErrorMessage(error, t('pdf.failed')), 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  return { download, downloadingId }
}
