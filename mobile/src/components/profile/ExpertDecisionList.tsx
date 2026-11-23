import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { GavelIcon, PencilSimpleIcon } from 'phosphor-react-native'
import { ActivityDetailSheet } from '@/components/profile/ActivityDetailSheet'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radius, Spacing } from '@/constants/theme'
import { useExpertActivityList } from '@/hooks/expert-activity/useExpertActivityList'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import type { ExpertActivityEntry } from '@/types'
import {
  type ActivityDetail,
  buildDecisionDetail,
  getDecisionActorText,
  getDecisionLines,
  getDetailPreview,
  getExpertActionLabel,
} from '@/utils/account.utils'
import { formatDateTime } from '@/utils/date.utils'
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
  // Quyết định đang mở trong bảng chi tiết; null là bảng đóng
  const [openedDetail, setOpenedDetail] = useState<ActivityDetail | null>(null)

  // Nơi áp dụng: nhà › khu vực, tra tên từ danh sách đã tải; không có thì bỏ
  const getScopeText = (zoneId?: string | null, houseId?: string | null): string => {
    const zone = zoneId ? directory.zoneById.get(zoneId) : undefined
    const house = directory.houseById.get(houseId ?? zone?.house_id ?? '')
    return [house?.name, zone?.name].filter(Boolean).join(' › ')
  }

  // Danh sách gọn: giờ đứng đầu dòng phụ để không bị tên nhà dài đẩy mất, chi tiết chỉ vài dòng đầu; bấm để xem đủ
  const renderDecision = (entry: ExpertActivityEntry, index: number, total: number) => {
    const scopeText = getScopeText(entry.zone_id, entry.house_id)
    return (
      <ProfileRow
        key={entry._id}
        icon={entry.action === 'ALERT_VERDICT_SET' ? GavelIcon : PencilSimpleIcon}
        label={getExpertActionLabel(entry.action)}
        value={entry._id === highlightedId ? t('Thông báo này') : undefined}
        caption={[`${formatDateTime(entry.created_at)} · ${getDecisionActorText(entry)}`, scopeText]
          .filter(Boolean)
          .join('\n')}
        details={getDetailPreview(getDecisionLines(entry))}
        onPress={() => setOpenedDetail(buildDecisionDetail(entry, scopeText))}
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
      {openedDetail && <ActivityDetailSheet detail={openedDetail} onClose={() => setOpenedDetail(null)} />}
    </>
  )
}

const styles = StyleSheet.create({
  listCard: { paddingVertical: Spacing.xs },
})
