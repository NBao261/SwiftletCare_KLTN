import { useState } from 'react'
import { router } from 'expo-router'
import { WarningIcon } from 'phosphor-react-native'
import { MAX_DETAIL_ITEMS, StatDetailSheet } from '@/components/home/StatDetailSheet'
import { StatTile, type StatTone } from '@/components/home/StatTile'
import { useActiveAlertSummary } from '@/hooks/alert/useActiveAlertSummary'
import { useAlerts } from '@/hooks/alert/useAlerts'
import { getSeverityLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Vài cảnh báo đang mở mới nhất cho phần chi tiết
const LATEST_ALERT_PARAMS = { status: 'ACTIVE', limit: String(MAX_DETAIL_ITEMS) }

// Câu tóm tắt: báo số cảnh báo mức Nghiêm trọng/Cao, không có thì nhắc chờ xác nhận
function getAlertSummary(total: number, urgent: number): string {
  if (total === 0) return t('Không có cảnh báo')
  if (urgent > 0) return t('{count} nghiêm trọng', { count: urgent })
  return t('Chờ xác nhận')
}

// Icon cam khi có cảnh báo đang mở; không có thì giữ màu trung tính (xanh chỉ dành cho thiết bị online)
function getAlertTone(total: number | undefined): StatTone {
  return total ? 'problem' : 'neutral'
}

// Ô 2: số cảnh báo đang mở của mọi Farm
export function AlertStatTile() {
  const [isSheetOpen, setSheetOpen] = useState(false)
  const { data: alertSummary, isLoading: isAlertSummaryLoading } = useActiveAlertSummary()
  // Vài cảnh báo đang mở mới nhất cho phần chi tiết
  const latestAlertsQuery = useAlerts(LATEST_ALERT_PARAMS)
  const latestAlerts = latestAlertsQuery.data?.data ?? []
  const value = alertSummary ? String(alertSummary.total) : '_'

  return (
    <>
      <StatTile
        icon={WarningIcon}
        tone={getAlertTone(alertSummary?.total)}
        label={t('Cảnh báo')}
        value={value}
        onPress={() => setSheetOpen(true)}
        isLoading={isAlertSummaryLoading}
      />
      <StatDetailSheet
        visible={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('Cảnh báo đang mở')}
        detailLabel={t('Xem chi tiết cảnh báo')}
        value={value}
        summary={alertSummary ? getAlertSummary(alertSummary.total, alertSummary.urgent) : '_'}
        items={latestAlerts.map(alert => ({
          key: alert._id,
          title: alert.title,
          description: getSeverityLabel(alert.severity),
          isProblem: alert.severity === 'CRITICAL' || alert.severity === 'HIGH',
        }))}
        hiddenCount={Math.max(0, (alertSummary?.total ?? 0) - latestAlerts.length)}
        onViewAll={() => router.navigate('/(tabs)/alerts')}
      />
    </>
  )
}
