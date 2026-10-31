import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretDownIcon, CaretUpIcon, WarningIcon } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Số dòng tối đa trong phần chi tiết — xem hết thì bấm "Xem tất cả"
export const MAX_DETAIL_ITEMS = 5

// Ô icon đầu dòng của mục "Xem chi tiết cảnh báo"
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
  // Câu tóm tắt hiện dưới tiêu đề phần chi tiết khi còn thu gọn
  summary: string
  items: StatDetailItem[]
  // Số mục không hiện trong danh sách (đã cắt bớt)
  hiddenCount: number
  onViewAll: () => void
}

// Bảng lựa chọn của một ô số liệu: phần "Xem chi tiết cảnh báo" mở/thu được và nút xem toàn bộ
export function StatDetailSheet({
  visible,
  onClose,
  title,
  value,
  summary,
  items,
  hiddenCount,
  onViewAll,
}: StatDetailSheetProps) {
  const palette = usePalette()
  const [isExpanded, setExpanded] = useState(false)
  const CaretIcon = isExpanded ? CaretUpIcon : CaretDownIcon

  // Đóng bảng thì thu gọn lại phần chi tiết cho lần mở sau
  const handleClose = () => {
    setExpanded(false)
    onClose()
  }

  const handleViewAll = () => {
    handleClose()
    onViewAll()
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        <Text variant="heading" weight="semiBold">
          {value}
        </Text>
      </View>

      <View style={[styles.detailBox, { backgroundColor: palette.surfaceStrong }]}>
        <Pressable
          style={styles.detailToggle}
          onPress={() => setExpanded(current => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={t('Xem chi tiết cảnh báo, {summary}', { summary })}
        >
          <View style={[styles.iconBox, { backgroundColor: palette.surface }]}>
            <WarningIcon size={20} color={palette.text} />
          </View>
          <View style={styles.detailTexts}>
            <Text variant="body" weight="semiBold">
              {t('Xem chi tiết cảnh báo')}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {summary}
            </Text>
          </View>
          <CaretIcon size={16} color={palette.text} />
        </Pressable>

        {isExpanded &&
          items.map(item => (
            <View key={item.key} style={[styles.detailRow, { borderTopColor: palette.divider }]}>
              <Text variant="small" weight="semiBold" numberOfLines={1} style={styles.detailTitle}>
                {item.title}
              </Text>
              <Text variant="small" color={item.isProblem ? palette.alert : palette.textSecondary}>
                {item.description}
              </Text>
            </View>
          ))}
        {isExpanded && hiddenCount > 0 && (
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
  detailBox: { borderRadius: Radius.md, paddingHorizontal: Spacing.lg },
  detailToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  detailTexts: { flex: 1, gap: Spacing.xs },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: BorderWidth.hairline,
  },
  detailTitle: { flex: 1 },
  moreText: { paddingBottom: Spacing.md },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
