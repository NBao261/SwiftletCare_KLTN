import { StyleSheet } from 'react-native'
import { GavelIcon, PencilSimpleIcon } from 'phosphor-react-native'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useExpertActivityList } from '@/hooks/expert-activity/useExpertActivityList'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import type { ExpertActivityEntry } from '@/types'
import { describeActivityChanges, getActivityVerdict, getExpertActionLabel } from '@/utils/account.utils'
import { formatDateTime } from '@/utils/date.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const LIST_SKELETON_HEIGHT = 160

interface ExpertDecisionListProps {
  farmId: string
  enabled: boolean
  // Quyết định mà thông báo đang xem nói tới (ref.id của thông báo expert_decision): dòng đó ghi "Thông báo này"
  highlightedId?: string
}

// Lịch sử quyết định của chuyên gia trên farm (EXPERT-FR-009, GET /expert-activity — gồm cả quyết định chủ trại làm thay khi
// farm chưa có chuyên gia, BR-22), mới nhất trước, tải thêm theo trang. Dùng ở màn Hoạt động chuyên gia và dưới chi tiết thông báo
export function ExpertDecisionList({ farmId, enabled, highlightedId }: ExpertDecisionListProps) {
  const directory = useZoneDirectory()
  const decisionsQuery = useExpertActivityList(farmId, enabled)

  // Nơi áp dụng: nhà › khu vực, tra tên từ danh sách đã tải; không có thì bỏ
  const getScopeText = (zoneId?: string | null, houseId?: string | null): string => {
    const zone = zoneId ? directory.zoneById.get(zoneId) : undefined
    const house = directory.houseById.get(houseId ?? zone?.house_id ?? '')
    return [house?.name, zone?.name].filter(Boolean).join(' › ')
  }

  const renderDecision = (entry: ExpertActivityEntry, index: number, total: number) => {
    const verdict = getActivityVerdict(entry.metadata)
    return (
      <ProfileRow
        key={entry._id}
        icon={entry.action === 'ALERT_VERDICT_SET' ? GavelIcon : PencilSimpleIcon}
        label={getExpertActionLabel(entry.action)}
        value={entry._id === highlightedId ? t('Thông báo này') : undefined}
        caption={[
          `${entry.actor?.full_name ?? '_'} (${getRoleLabel(entry.actor_role)}) · ${formatDateTime(entry.created_at)}`,
          getScopeText(entry.zone_id, entry.house_id),
        ]
          .filter(Boolean)
          .join('\n')}
        // Chi tiết đủ, không cắt: kết luận cảnh báo, chỉ số nào đổi từ bao nhiêu thành bao nhiêu, ghi chú / lý do
        details={[
          ...(verdict ? [verdict === 'CONFIRMED' ? t('Kết luận: cảnh báo đúng') : t('Kết luận: bác bỏ cảnh báo')] : []),
          ...describeActivityChanges(entry),
        ]}
        hasDivider={index < total - 1}
      />
    )
  }

  if (decisionsQuery.isLoading) return <Skeleton width="100%" height={LIST_SKELETON_HEIGHT} radius={Radius.lg} />
  if (decisionsQuery.isError) {
    return (
      <EmptyState
        message={t('Không tải được hoạt động chuyên gia')}
        actionLabel={t('Thử lại')}
        onAction={() => decisionsQuery.refetch()}
      />
    )
  }
  const entries = decisionsQuery.data?.pages.flatMap(page => page.data) ?? []
  if (entries.length === 0) return <EmptyState message={t('Chưa có quyết định nào của chuyên gia')} />
  return (
    <>
      <Card style={styles.listCard}>{entries.map((entry, index) => renderDecision(entry, index, entries.length))}</Card>
      {decisionsQuery.hasNextPage && (
        <Button
          label={t('Xem thêm')}
          variant="link"
          loading={decisionsQuery.isFetchingNextPage}
          onPress={() => decisionsQuery.fetchNextPage()}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: Spacing.xs },
})
