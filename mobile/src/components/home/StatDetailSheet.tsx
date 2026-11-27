import { ScrollView, StyleSheet, View } from 'react-native'
import { WarningIcon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Khung danh sách cao vừa 5 dòng; nhiều hơn thì cuộn trong khung
const VISIBLE_DETAIL_ROWS = 5
// Một dòng: chữ nhỏ một dòng + lề trên dưới + đường kẻ
const DETAIL_ROW_HEIGHT = Typography.small.lineHeight + Spacing.sm * 2 + BorderWidth.hairline
const DETAIL_LIST_MAX_HEIGHT = VISIBLE_DETAIL_ROWS * DETAIL_ROW_HEIGHT

// Ô icon đầu khối chi tiết
const ICON_BOX_SIZE = 40

// Một dòng trong phần chi tiết: tên (thiết bị, cảnh báo, tầng) và mô tả tình trạng
export interface StatDetailItem {
  key: string
  title: string
  description: string
  isProblem: boolean
}

interface StatDetailSheetProps {
  visible: boolean
  onClose: () => void
  title: string
  value: string
  // Tên danh sách theo nội dung của ô: "Thiết bị chưa online", "Cảnh báo mới nhất"…
  listTitle: string
  // Câu tóm tắt dưới tên danh sách
  summary: string
  items: StatDetailItem[]
  // Số mục server còn mà danh sách không tải về (vd. cảnh báo chỉ tải một trang)
  hiddenCount: number
  onViewAll: () => void
}

// Bảng của một ô số liệu: mở ra là thấy luôn danh sách chi tiết (khung 5 dòng, cuộn khi nhiều hơn) và nút xem toàn bộ
export function StatDetailSheet({
  visible,
  onClose,
  title,
  value,
  listTitle,
  summary,
  items,
  hiddenCount,
  onViewAll,
}: StatDetailSheetProps) {
  const palette = usePalette()

  const handleViewAll = () => {
    onClose()
    onViewAll()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        <Text variant="heading" weight="semiBold">
          {value}
        </Text>
      </View>

      <View style={[styles.detailBox, { backgroundColor: palette.surfaceStrong }]}>
        <View style={styles.detailHeader} accessible accessibilityLabel={`${listTitle}, ${summary}`}>
          <View style={[styles.iconBox, { backgroundColor: palette.surface }]}>
            <WarningIcon size={20} color={palette.text} />
          </View>
          <View style={styles.detailTexts}>
            <Text variant="body" weight="semiBold">
              {listTitle}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {summary}
            </Text>
          </View>
        </View>

        {items.length > 0 && (
          // Cuộn lồng trong bảng: Android cần nestedScrollEnabled. Khung cuộn tràn hết bề ngang khối (lề đặt vào nội dung) để
          // thanh cuộn nằm sát mép phải khối, không đè lên chữ
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {items.map(item => (
              <View key={item.key} style={[styles.detailRow, { borderTopColor: palette.divider }]}>
                <Text variant="small" weight="semiBold" numberOfLines={1} style={styles.detailTitle}>
                  {item.title}
                </Text>
                <Text variant="small" color={item.isProblem ? palette.alert : palette.textSecondary}>
                  {item.description}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
        {hiddenCount > 0 && (
          <Text variant="small" color={palette.textSecondary} style={styles.moreText}>
            {t('Còn {count} mục khác', { count: hiddenCount })}
          </Text>
        )}
      </View>

      <Button label={t('Xem tất cả')} onPress={handleViewAll} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailBox: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  detailTexts: { flex: 1, gap: Spacing.xs },
  list: { maxHeight: DETAIL_LIST_MAX_HEIGHT, marginHorizontal: -Spacing.lg },
  listContent: { paddingHorizontal: Spacing.lg },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: BorderWidth.hairline,
  },
  detailTitle: { flex: 1 },
  moreText: { paddingTop: Spacing.sm },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
