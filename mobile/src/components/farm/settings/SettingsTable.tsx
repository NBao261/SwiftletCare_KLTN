import { Fragment } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { SettingsInput, type SettingsInputProps } from '@/components/farm/settings/SettingsInput'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

const CARET_SIZE = 16

export interface SettingsTableColumn {
  label: string
  // Cột số căn phải như cột "Amount" trong ảnh mẫu
  align?: 'left' | 'right'
  // Độ rộng tương đối; cột tên thường rộng hơn
  flex?: number
}

// Một ô: chữ để xem, ô nhập khi đang sửa, hoặc null khi chỉ số không có giá trị đó (ánh sáng không có mức thấp)
export type SettingsTableCell = { text: string; isMuted?: boolean } | { input: SettingsInputProps } | null

export interface SettingsTableRow {
  id: string
  cells: SettingsTableCell[]
  // Lỗi của dòng khi đang sửa, hiện ngay dưới dòng
  error?: string | null
  // Có thì cả dòng bấm được (ví dụ mở cài đặt một nhà)
  onPress?: () => void
  accessibilityLabel?: string
}

interface SettingsTableProps {
  columns: SettingsTableColumn[]
  rows: SettingsTableRow[]
  // Bảng chưa có dòng nào
  emptyText?: string
}

// Bảng của trang cài đặt theo ảnh mẫu: dòng tiêu đề nền Paper bo nhỏ, các dòng kẻ mảnh, cột số căn phải
export function SettingsTable({ columns, rows, emptyText }: SettingsTableProps) {
  const palette = usePalette()
  // Dòng bấm được có mũi tên cuối dòng: dòng tiêu đề chừa chỗ để cột thẳng hàng
  const hasRowAction = rows.some(row => row.onPress)

  const renderCell = (cell: SettingsTableCell, column: SettingsTableColumn, index: number) => {
    const style = [styles.cell, { flex: column.flex ?? 1 }]
    if (cell === null) return <View key={index} style={style} />
    if ('input' in cell) {
      return (
        <View key={index} style={style}>
          <SettingsInput align={column.align ?? 'left'} {...cell.input} />
        </View>
      )
    }
    return (
      <View key={index} style={style}>
        <Text
          variant="body"
          weight={index === 0 ? 'regular' : 'semiBold'}
          color={cell.isMuted ? palette.textSecondary : palette.text}
          style={[column.align === 'right' && styles.right, styles.number]}
          numberOfLines={2}
        >
          {cell.text}
        </Text>
      </View>
    )
  }

  return (
    <View>
      <View style={[styles.headerRow, { backgroundColor: palette.surfaceStrong }]}>
        {columns.map(column => (
          <Text
            key={column.label}
            variant="small"
            weight="semiBold"
            color={palette.textSecondary}
            style={[styles.cell, { flex: column.flex ?? 1 }, column.align === 'right' && styles.right]}
            numberOfLines={1}
          >
            {column.label}
          </Text>
        ))}
        {hasRowAction && <View style={styles.caretSpace} />}
      </View>
      {rows.length === 0 && emptyText ? (
        <Text variant="small" color={palette.textSecondary} style={styles.empty}>
          {emptyText}
        </Text>
      ) : (
        rows.map((row, rowIndex) => {
          const content = (
            <>
              <View style={styles.row}>
                {row.cells.map((cell, index) => renderCell(cell, columns[index], index))}
                {row.onPress && <CaretRightIcon size={CARET_SIZE} color={palette.textSecondary} weight="bold" />}
              </View>
              {row.error ? (
                <Text variant="small" color={palette.alert} style={styles.error} accessibilityLiveRegion="polite">
                  {row.error}
                </Text>
              ) : null}
            </>
          )
          const separator = rowIndex > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }
          return (
            <Fragment key={row.id}>
              {row.onPress ? (
                <Pressable
                  style={separator}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={row.accessibilityLabel}
                >
                  {content}
                </Pressable>
              ) : (
                <View
                  style={separator}
                  accessible={Boolean(row.accessibilityLabel)}
                  accessibilityLabel={row.accessibilityLabel}
                >
                  {content}
                </View>
              )}
            </Fragment>
          )
        })
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  cell: { minWidth: 0 },
  caretSpace: { width: CARET_SIZE },
  right: { textAlign: 'right' },
  number: { fontVariant: ['tabular-nums'] },
  error: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  empty: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
})
