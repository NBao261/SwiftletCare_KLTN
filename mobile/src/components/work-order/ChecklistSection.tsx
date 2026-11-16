import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { CaretRightIcon, CheckCircleIcon, CircleIcon, WarningCircleIcon } from 'phosphor-react-native'
import { ChecklistItemSheet } from '@/components/work-order/ChecklistItemSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { ChecklistItem } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { getChecklistResultLabel } from '@/utils/label.utils'
import { getChecklistProgress } from '@/utils/maintenance.utils'
import { t } from '@/utils/i18n.utils'

const PHOTO_SIZE = 64

interface ChecklistSectionProps {
  workOrderId: string
  checklist: ChecklistItem[]
  // Work Order phòng ngừa đang IN_PROGRESS và người dùng được làm: chạm mục để ghi
  isEditable: boolean
  onMessage: (message: string) => void
}

// Checklist của Work Order phòng ngừa (OPS-FR-007): từng mục với kết quả Đạt / Hỏng / chưa làm, ghi chú, ảnh, lúc ghi; mục Hỏng có
// lối mở Work Order sửa chữa đã mở từ nó. Đang làm thì chạm mục để ghi hoặc ghi lại; phải ghi đủ mới báo xong được (BR-41)
export function ChecklistSection({ workOrderId, checklist, isEditable, onMessage }: ChecklistSectionProps) {
  const palette = usePalette()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const progress = getChecklistProgress(checklist)
  const editingItem = editingIndex === null ? null : checklist[editingIndex]

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="body" weight="semiBold" style={styles.flex}>
          {t('Checklist bảo trì')}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary}>
          {t('{done}/{total} mục', { done: progress.done, total: progress.total })}
        </Text>
      </View>
      {checklist.map((item, index) => {
        const ResultIcon = item.result === 'OK' ? CheckCircleIcon : item.result === 'DEFECT' ? WarningCircleIcon : CircleIcon
        const resultText = item.result ? getChecklistResultLabel(item.result) : t('Chưa làm')
        const content = (
          <>
            <ResultIcon
              size={20}
              color={item.result === 'DEFECT' ? palette.alert : item.result ? palette.text : palette.textSecondary}
              weight={item.result ? 'fill' : 'regular'}
            />
            <View style={styles.texts}>
              <Text variant="body">{item.item}</Text>
              <Text variant="small" color={item.result === 'DEFECT' ? palette.alert : palette.textSecondary}>
                {item.at ? `${resultText} · ${formatDateTime(item.at)}` : resultText}
              </Text>
              {item.note ? (
                <Text variant="small" color={palette.textSecondary}>
                  {item.note}
                </Text>
              ) : null}
              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={[styles.photo, { backgroundColor: palette.surfaceStrong }]}
                  contentFit="cover"
                  accessibilityLabel={t('Ảnh mục {item}', { item: item.item })}
                />
              ) : null}
              {item.repair_work_order_id ? (
                <Button
                  variant="link"
                  label={t('Xem phiếu công việc sửa chữa')}
                  onPress={() =>
                    router.push({
                      pathname: '/work-orders/[workOrderId]',
                      params: { workOrderId: item.repair_work_order_id as string },
                    })
                  }
                  style={styles.link}
                />
              ) : null}
            </View>
            {isEditable && <CaretRightIcon size={16} color={palette.textSecondary} />}
          </>
        )
        const rowStyle = [
          styles.row,
          index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider },
        ]
        return isEditable ? (
          <Pressable
            key={`${index}-${item.item}`}
            style={rowStyle}
            onPress={() => setEditingIndex(index)}
            accessibilityRole="button"
            accessibilityLabel={`${item.item}, ${resultText}`}
            accessibilityHint={t('Ghi kết quả mục này')}
          >
            {content}
          </Pressable>
        ) : (
          <View key={`${index}-${item.item}`} style={rowStyle}>
            {content}
          </View>
        )
      })}
      {isEditable && !progress.isComplete && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Ghi đủ các mục mới báo xong được. Mục nào hỏng, hệ thống mở phiếu công việc sửa chữa cho mục đó.')}
        </Text>
      )}
      {editingItem && editingIndex !== null && (
        <ChecklistItemSheet
          workOrderId={workOrderId}
          item={editingItem}
          itemIndex={editingIndex}
          onClose={() => setEditingIndex(null)}
          onDone={message => {
            setEditingIndex(null)
            onMessage(message)
          }}
        />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: Radius.sm },
  link: { alignSelf: 'flex-start' },
})
