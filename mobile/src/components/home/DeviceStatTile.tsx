import { useState } from 'react'
import { router } from 'expo-router'
import { WifiHighIcon } from 'phosphor-react-native'
import { MAX_DETAIL_ITEMS, StatDetailSheet } from '@/components/home/StatDetailSheet'
import { StatTile, type StatTone } from '@/components/home/StatTile'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { summarizeDeviceStatuses, type DeviceStatusSummary } from '@/utils/device.utils'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Câu tóm tắt: ưu tiên báo thiết bị mất kết nối, rồi tới thiết bị chưa gửi heartbeat đầu tiên
function getDeviceSummary(summary: DeviceStatusSummary): string {
  if (summary.total === 0) return t('Chưa có thiết bị')
  if (summary.offline > 0) return t('{count} mất kết nối', { count: summary.offline })
  if (summary.pending > 0) return t('{count} chờ kết nối', { count: summary.pending })
  return t('Tất cả đang online')
}

// Icon xanh khi mọi thiết bị online, cam khi có thiết bị mất kết nối
function getDeviceTone(summary: DeviceStatusSummary | null): StatTone {
  if (!summary || summary.total === 0) return 'neutral'
  if (summary.offline > 0) return 'problem'
  return summary.pending > 0 ? 'neutral' : 'healthy'
}

// Ô 1: số thiết bị (bộ điều khiển + camera) đang online trên tổng, cộng mọi Farm
export function DeviceStatTile() {
  const [isSheetOpen, setSheetOpen] = useState(false)
  const sensorNodesQuery = useSensorNodes()
  const cameraNodesQuery = useCameraNodes()
  const sensorNodes = sensorNodesQuery.data?.data
  const cameraNodes = cameraNodesQuery.data?.data

  const nodes = sensorNodes && cameraNodes ? [...sensorNodes, ...cameraNodes] : null
  const summary = nodes ? summarizeDeviceStatuses(nodes.map(node => node.status)) : null
  // Phần chi tiết chỉ liệt kê thiết bị chưa online
  const notOnlineNodes = (nodes ?? []).filter(node => node.status !== 'ONLINE')

  return (
    <>
      <StatTile
        icon={WifiHighIcon}
        tone={getDeviceTone(summary)}
        label={t('Thiết bị')}
        value={summary ? `${summary.online}/${summary.total}` : '_'}
        onPress={() => setSheetOpen(true)}
        isLoading={sensorNodesQuery.isLoading || cameraNodesQuery.isLoading}
      />
      <StatDetailSheet
        visible={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('Thiết bị online')}
        detailLabel={t('Xem chi tiết thiết bị')}
        value={summary ? `${summary.online}/${summary.total}` : '_'}
        summary={summary ? getDeviceSummary(summary) : '_'}
        items={notOnlineNodes.slice(0, MAX_DETAIL_ITEMS).map(node => ({
          key: node._id,
          title: node.device_id,
          description: getDeviceStatusLabel(node.status),
          isProblem: node.status === 'OFFLINE',
        }))}
        hiddenCount={Math.max(0, notOnlineNodes.length - MAX_DETAIL_ITEMS)}
        // shortcut: chưa có tab Thiết bị lọc offline — tạm mở tab Trang trại
        onViewAll={() => router.navigate('/(tabs)/farms')}
      />
    </>
  )
}
