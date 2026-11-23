import { ScrollView, StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ActivityDetail } from '@/utils/account.utils'
import { t } from '@/utils/i18n.utils'

// Phần cuộn của bảng, chừa chỗ cho tiêu đề và nút Đóng khi nội dung dài
const CONTENT_MAX_HEIGHT = 420

interface ActivityDetailSheetProps {
  detail: ActivityDetail
  onClose: () => void
}

// Bảng chi tiết khi bấm một dòng ở màn Hoạt động chuyên gia: đủ nơi, giờ, mọi giá trị cũ → mới và ghi chú dài, không cắt
export function ActivityDetailSheet({ detail, onClose }: ActivityDetailSheetProps) {
  const palette = usePalette()

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{detail.title}</Text>
        {detail.status && (
          <Text variant="small" color={palette.textSecondary}>
            {detail.status}
          </Text>
        )}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View>
          {detail.facts.map(fact => (
            <StatRow key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </View>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary}>
            {t('Chi tiết')}
          </Text>
          {detail.lines.length === 0 ? (
            <Text variant="small">_</Text>
          ) : (
            detail.lines.map((line, index) => (
              <Text key={`${index}-${line}`} variant="small">
                {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
      <Button label={t('Đóng')} variant="outline" size="md" onPress={onClose} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  scroll: { maxHeight: CONTENT_MAX_HEIGHT, flexGrow: 0 },
  body: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
})
