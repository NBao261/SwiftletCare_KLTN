import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { useZoneRelayOverrides } from '@/hooks/analytics/useZoneRelayOverrides'
import { usePalette } from '@/hooks/theme/usePalette'
import type { RelayOverrideLog } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { getRelayLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Card chỉ hiện vài lần gần nhất, còn lại xem trong sheet
const VISIBLE_COUNT = 5
const SKELETON_HEIGHT = 120
const SHEET_LIST_MAX_HEIGHT = 420

// Lý do kết thúc theo enum backend (RelayOverrideLog.end_reason); null là đang chạy
function getEndReasonLabel(log: RelayOverrideLog): string {
  if (log.end_reason === 'EXPIRED') return t('Hết giờ')
  if (log.end_reason === 'CLEARED_EARLY') return t('Trả về AUTO sớm')
  if (log.end_reason === 'REPLACED') return t('Bị thay bằng lệnh khác')
  return t('Đang chạy')
}

// Một dòng: relay và trạng thái ép, người bật, bắt đầu – kết thúc, lý do kết thúc
function OverrideRow({ log, hasDivider }: { log: RelayOverrideLog; hasDivider: boolean }) {
  const palette = usePalette()
  const endText = log.ended_at ? formatDateTime(log.ended_at) : t('đang chạy')
  return (
    <View style={[styles.row, hasDivider && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.border }]}>
      <View style={styles.rowHeader}>
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {`${getRelayLabel(log.relay)} · ${log.state ? t('Bật') : t('Tắt')}`}
        </Text>
        <Text variant="small" color={log.ended_at ? palette.textSecondary : palette.houseHealthy}>
          {getEndReasonLabel(log)}
        </Text>
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {`${log.started_by?.full_name ?? '_'} · ${formatDateTime(log.started_at)} – ${endText}`}
      </Text>
    </View>
  )
}

// Lịch sử điều khiển tay của một tầng (ENV-FR-019): vài lần gần nhất, "Xem tất cả" mở sheet
export function OverrideHistoryCard({ zoneId }: { zoneId: string }) {
  const palette = usePalette()
  const overridesQuery = useZoneRelayOverrides(zoneId, true)
  const [isSheetOpen, setSheetOpen] = useState(false)
  const overrides = overridesQuery.overrides

  return (
    <Card>
      <Text variant="body" weight="semiBold">
        {t('Lịch sử điều khiển tay')}
      </Text>
      {overridesQuery.isLoading ? (
        <Skeleton width="100%" height={SKELETON_HEIGHT} />
      ) : overridesQuery.isError ? (
        <Text variant="small" color={palette.textSecondary} onPress={() => overridesQuery.refetch()}>
          {t('Không tải được. Chạm để thử lại')}
        </Text>
      ) : overrides.length === 0 ? (
        <Text variant="small" color={palette.textSecondary}>
          {t('Chưa có lần điều khiển tay nào')}
        </Text>
      ) : (
        <View>
          {overrides.slice(0, VISIBLE_COUNT).map((log, index) => (
            <OverrideRow key={log._id} log={log} hasDivider={index > 0} />
          ))}
        </View>
      )}
      {overrides.length > VISIBLE_COUNT && (
        <Button
          label={t('Xem tất cả ({count})', { count: overrides.length })}
          variant="link"
          onPress={() => setSheetOpen(true)}
        />
      )}
      <BottomSheet visible={isSheetOpen} onClose={() => setSheetOpen(false)}>
        <Text variant="heading">{t('Lịch sử điều khiển tay')}</Text>
        <ScrollView style={styles.sheetList}>
          {overrides.map((log, index) => (
            <OverrideRow key={log._id} log={log} hasDivider={index > 0} />
          ))}
        </ScrollView>
      </BottomSheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  sheetList: { maxHeight: SHEET_LIST_MAX_HEIGHT },
})
