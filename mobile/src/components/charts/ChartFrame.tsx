import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

// Chiều cao cố định của vùng biểu đồ dọc để đổi bộ lọc không làm giật bố cục (đặc tả §8)
export const CHART_HEIGHT = 220
const LEGEND_SWATCH_WIDTH = 14
const LEGEND_SWATCH_HEIGHT = 3

export interface ChartLegendItem {
  label: string
  color: string
  // Nét đứt (dự báo)
  isDashed?: boolean
  // Chạm chú thích để ẩn/hiện chuỗi (so sánh tầng)
  isHidden?: boolean
  onPress?: () => void
}

interface ChartFrameProps {
  title?: string
  // Câu tóm tắt cho trình đọc màn hình, ví dụ "Độ ẩm 7 ngày, thấp nhất 72%, cao nhất 93%"
  summary: string
  height?: number
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  // Đang tải lại khi đổi bộ lọc: giữ biểu đồ cũ mờ đi, không nháy về khung xương
  isFetching?: boolean
  onRetry: () => void
  // Rỗng: nút gợi ý xem khoảng dài hơn
  emptyAction?: { label: string; onPress: () => void }
  emptyMessage?: string
  legend?: ChartLegendItem[]
  headerRight?: ReactNode
  // Vẽ biểu đồ theo chiều rộng đo được của khung
  children: (width: number) => ReactNode
}

// Khung một biểu đồ của màn Phân tích: tiêu đề, chú thích, vùng vẽ cao cố định và bốn trạng thái
// (đang tải, rỗng, lỗi kèm Thử lại, có dữ liệu). Thư viện biểu đồ chỉ dùng trong components/charts
export function ChartFrame({
  title,
  summary,
  height = CHART_HEIGHT,
  isLoading,
  isError,
  isEmpty,
  isFetching = false,
  onRetry,
  emptyAction,
  emptyMessage,
  legend,
  headerRight,
  children,
}: ChartFrameProps) {
  const palette = usePalette()
  const [width, setWidth] = useState(0)

  const handleLayout = (event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width))

  const renderBody = () => {
    if (isLoading) return <Skeleton width="100%" height={height} radius={Radius.md} />
    if (isError) {
      return (
        <View style={[styles.message, { height }]}>
          <Text variant="small" color={palette.textSecondary} center>
            {t('Không tải được biểu đồ')}
          </Text>
          <Button label={t('Thử lại')} variant="link" onPress={onRetry} />
        </View>
      )
    }
    if (isEmpty) {
      return (
        <View style={[styles.message, { height }]}>
          <Text variant="small" color={palette.textSecondary} center>
            {emptyMessage ?? t('Chưa có dữ liệu trong khoảng này')}
          </Text>
          {emptyAction && <Button label={emptyAction.label} variant="link" onPress={emptyAction.onPress} />}
        </View>
      )
    }
    return (
      <View
        style={[{ height }, isFetching && styles.fetching]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        {width > 0 ? children(width) : null}
      </View>
    )
  }

  return (
    <View style={styles.frame}>
      {(title || headerRight) && (
        <View style={styles.header}>
          {title ? (
            <Text variant="body" weight="semiBold" style={styles.flex}>
              {title}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {headerRight}
        </View>
      )}
      {legend && legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map(item => (
            <Pressable
              key={item.label}
              style={[styles.legendItem, item.isHidden && styles.legendHidden]}
              onPress={item.onPress}
              disabled={!item.onPress}
              hitSlop={Spacing.sm}
              accessibilityRole={item.onPress ? 'button' : 'text'}
              accessibilityState={item.onPress ? { selected: !item.isHidden } : undefined}
              accessibilityLabel={item.label}
            >
              <View
                style={[
                  styles.swatch,
                  item.isDashed
                    ? { borderTopWidth: LEGEND_SWATCH_HEIGHT, borderStyle: 'dashed', borderColor: item.color }
                    : { backgroundColor: item.color },
                ]}
              />
              <Text variant="small" color={palette.textSecondary}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View onLayout={handleLayout}>{renderBody()}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendHidden: { opacity: 0.4 },
  swatch: { width: LEGEND_SWATCH_WIDTH, height: LEGEND_SWATCH_HEIGHT, borderRadius: BorderWidth.strong },
  message: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg },
  fetching: { opacity: 0.5 },
})
