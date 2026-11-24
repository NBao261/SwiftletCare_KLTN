import { ScrollView, StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Recommendation } from '@/types'
import { formatDate } from '@/utils/date.utils'
import { getRecommendationStatusLabel } from '@/utils/label.utils'
import {
  describeRecommendationAction,
  describeRecommendationCondition,
  formatEvidenceValue,
  getRecommendationAction,
  getRecommendationRuleName,
} from '@/utils/recommendation.utils'
import { t } from '@/utils/i18n.utils'

// Phần nội dung cuộn được tối đa cao chừng này để hai nút quyết định luôn thấy
const CONTENT_MAX_HEIGHT = 420

interface RecommendationSheetProps {
  // null: sheet đóng
  recommendation: Recommendation | null
  houseName: string
  // Chủ trại và khuyến nghị còn chờ quyết định thì có hai nút
  canDecide: boolean
  isAccepting: boolean
  error?: string | null
  onAccept: () => void
  onReject: () => void
  onOpenWorkOrder: (workOrderId: string) => void
  onClose: () => void
}

// Chi tiết một khuyến nghị (EXPERT-FR-017…019): luật, nhà, điều kiện, bằng chứng từng ngày, việc sẽ làm khi chấp nhận, kết quả đã
// quyết định và hiệu quả đo sau 7 ngày. Chủ trại chấp nhận hoặc từ chối khi còn chờ quyết định
export function RecommendationSheet({
  recommendation,
  houseName,
  canDecide,
  isAccepting,
  error,
  onAccept,
  onReject,
  onOpenWorkOrder,
  onClose,
}: RecommendationSheetProps) {
  const palette = usePalette()
  if (!recommendation) return null

  const isOpen = recommendation.status === 'OPEN'
  const effect = recommendation.effect

  return (
    <BottomSheet visible onClose={isAccepting ? () => undefined : onClose}>
      <Text variant="heading">{getRecommendationRuleName(recommendation)}</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View>
          <StatRow label={t('Nhà yến')} value={houseName} />
          <StatRow label={t('Ngày luật thoả')} value={formatDate(recommendation.raised_for)} />
          <StatRow label={t('Trạng thái')} value={getRecommendationStatusLabel(recommendation.status)} />
        </View>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {t('Việc đề xuất')}
          </Text>
          <Text variant="body" weight="semiBold">
            {describeRecommendationAction(getRecommendationAction(recommendation))}
          </Text>
        </View>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {t('Bằng chứng')}
          </Text>
          <Text variant="small">{describeRecommendationCondition(recommendation)}</Text>
          <SettingsTable
            columns={[
              { label: t('Ngày'), flex: 1.2 },
              { label: t('Giá trị'), align: 'right' },
            ]}
            rows={recommendation.evidence.days.map(day => ({
              id: day.date,
              cells: [{ text: formatDate(day.date) }, { text: formatEvidenceValue(recommendation, day.value) }],
            }))}
            emptyText={t('Chưa có số liệu')}
          />
        </View>
        {recommendation.reject_reason ? (
          <View style={styles.field}>
            <Text variant="small" weight="semiBold" color={palette.textSecondary}>
              {t('Lý do từ chối')}
            </Text>
            <Text variant="small">{recommendation.reject_reason}</Text>
          </View>
        ) : null}
        {/* Hiệu quả: trung bình 7 ngày sau so với 7 ngày trước ngày chấp nhận (EXPERT-FR-019) */}
        {effect && (
          <View>
            <StatRow label={t('7 ngày trước')} value={formatEvidenceValue(recommendation, effect.before)} />
            <StatRow label={t('7 ngày sau')} value={formatEvidenceValue(recommendation, effect.after)} />
            <StatRow
              label={t('Kết quả')}
              value={effect.improved === null ? '_' : effect.improved ? t('Có cải thiện') : t('Chưa cải thiện')}
            />
          </View>
        )}
      </ScrollView>
      {recommendation.work_order_id && (
        <Button
          label={t('Xem phiếu công việc')}
          variant="outline"
          size="md"
          onPress={() => onOpenWorkOrder(recommendation.work_order_id as string)}
        />
      )}
      <FormMessage message={error} />
      {canDecide && isOpen && (
        <View style={styles.actions}>
          <Button label={t('Từ chối')} variant="outline" onPress={onReject} disabled={isAccepting} style={styles.flex} />
          <Button label={t('Chấp nhận')} onPress={onAccept} loading={isAccepting} style={styles.flex} />
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: CONTENT_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
})
