import { StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { BirdCountToday } from '@/types'
import { formatBirdDayFigures } from '@/utils/camera.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

// Chỗ chừa sẵn cho số lớn nhất của một nhà yến: chim ra/về 5 chữ số ("00.000"), tỷ lệ về tổ "000%" —
// số thật luôn nằm gọn trong khoảng này nên không tràn, không đẩy cột khác
const COUNT_PLACEHOLDER = 99_999
const RATE_PLACEHOLDER = 100

interface BirdCountStripProps {
  // Chưa tải xong hoặc nhà chưa có số đếm thì không có — các số hiện "_"
  today: BirdCountToday | undefined
  // Chạm: mở tab Đàn chim ở Phân tích
  onPress?: () => void
}

interface FigureColumn {
  label: string
  value: string
  // Chuỗi dài nhất có thể của cột, giữ chỗ cho số
  placeholder: string
}

// Dải đàn chim hôm nay của nhà (VISION-FR-008, 009): card trắng 3 cột ngăn bằng vạch dọc — nhãn nhỏ nét thường ở trên, số lớn nét đậm nhất (Bold) ở dưới, cùng màu Ink
export function BirdCountStrip({ today, onPress }: BirdCountStripProps) {
  const palette = usePalette()
  const figures = formatBirdDayFigures(today)
  const countPlaceholder = formatDecimal(COUNT_PLACEHOLDER)
  const columns: FigureColumn[] = [
    { label: t('Chim ra'), value: figures.exitText, placeholder: countPlaceholder },
    { label: t('Chim về'), value: figures.entryText, placeholder: countPlaceholder },
    {
      label: t('Tỷ lệ về tổ'),
      value: figures.rateText,
      placeholder: formatPercentValue(RATE_PLACEHOLDER, 0),
    },
  ]

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      accessibilityHint={onPress ? t('Mở biểu đồ đàn chim ở Phân tích') : undefined}
      accessibilityLabel={t('Hôm nay: {text}', {
        text: columns.map(column => `${column.label} ${column.value}`).join(', '),
      })}
    >
      {columns.map((column, index) => (
        <View
          key={column.label}
          style={[
            styles.column,
            index > 0 && { borderLeftWidth: BorderWidth.hairline, borderLeftColor: palette.divider },
          ]}
        >
          <Text variant="small" color={palette.text} numberOfLines={1}>
            {column.label}
          </Text>
          {/* Chuỗi giữ chỗ ẩn quyết định bề rộng; số thật đè lên đúng chỗ đó */}
          <View style={styles.valueBox}>
            <Text variant="heading" weight="bold" style={[styles.digits, styles.placeholder]} importantForAccessibility="no">
              {column.placeholder}
            </Text>
            <Text
              variant="heading"
              weight="bold"
              color={palette.text}
              numberOfLines={1}
              style={[styles.digits, styles.value]}
            >
              {column.value}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 0, paddingHorizontal: 0, paddingVertical: Spacing.md },
  column: { flex: 1, minWidth: 0, gap: Spacing.xs, paddingHorizontal: Spacing.md },
  valueBox: { alignSelf: 'flex-start' },
  // Chữ số cùng bề rộng để chuỗi giữ chỗ đo đúng mọi số
  digits: { fontVariant: ['tabular-nums'] },
  placeholder: { opacity: 0 },
  value: { position: 'absolute', top: 0, left: 0, right: 0 },
})
