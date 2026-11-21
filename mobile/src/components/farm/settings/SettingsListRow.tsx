import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

interface SettingsListRowProps {
  title: string
  // Chữ đậm bên phải dòng chính (khoảng ngày, Bật / Tắt)
  trailing?: string
  // Chữ trailing màu phụ (ví dụ luật đang tắt)
  isTrailingMuted?: boolean
  // Dòng phụ màu xám dưới dòng chính
  caption: string
  hasDivider: boolean
  // Có thì cả dòng bấm được, có mũi tên cuối dòng (chế độ sửa)
  onPress?: () => void
}

// Một dòng danh sách trong mục cài đặt khi bảng nhiều cột quá chật: dòng chính (tên + chữ đậm bên phải) và dòng phụ xám —
// dùng cho lịch đếm chim, luật bù thời tiết
export function SettingsListRow({ title, trailing, isTrailingMuted, caption, hasDivider, onPress }: SettingsListRowProps) {
  const palette = usePalette()
  const rowStyle = [styles.row, hasDivider && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]
  const content = (
    <>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text variant="body" weight="semiBold" numberOfLines={1} style={styles.flex}>
            {title}
          </Text>
          {trailing ? (
            <Text variant="body" weight="semiBold" numberOfLines={1} color={isTrailingMuted ? palette.textSecondary : undefined}>
              {trailing}
            </Text>
          ) : null}
        </View>
        <Text variant="small" color={palette.textSecondary}>
          {caption}
        </Text>
      </View>
      {onPress && <CaretRightIcon size={16} color={palette.textSecondary} />}
    </>
  )
  if (!onPress) return <View style={rowStyle}>{content}</View>
  return (
    <Pressable
      style={rowStyle}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, trailing, caption].filter(Boolean).join(', ')}
    >
      {content}
    </Pressable>
  )
}

// Khung bao các dòng: nền Paper bo vừa trong card trắng; trống thì một câu xám
export function SettingsList({ isEmpty, emptyText, children }: { isEmpty: boolean; emptyText: string; children: ReactNode }) {
  const palette = usePalette()
  return (
    <View style={[styles.list, { backgroundColor: palette.surfaceStrong }]}>
      {isEmpty ? (
        <Text variant="small" color={palette.textSecondary} style={styles.empty}>
          {emptyText}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  empty: { paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
})
