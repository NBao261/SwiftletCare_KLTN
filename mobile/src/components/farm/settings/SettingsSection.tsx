import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretDownIcon, CaretUpIcon, PencilSimpleIcon, type Icon } from 'phosphor-react-native'
import { SettingsTileButton, type SettingsTileAction } from '@/components/farm/settings/SettingsTileButton'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

const ICON_TILE_SIZE = 44
// Nút "Sửa" thấp hơn 44 nên nới vùng chạm cho đủ 44 (MOBILE_GUIDE 3.7)
const EDIT_HIT_SLOP = Spacing.sm

interface SettingsSectionProps {
  icon: Icon
  title: string
  subtitle?: string
  // Nhãn nhỏ viết hoa góc trên phải: phạm vi của mục ("TẦNG 2", "NHÀ", "TRANG TRẠI")
  scopeLabel: string
  isExpanded: boolean
  // Không truyền: mục luôn mở, đầu card không bấm được (form tạo mới)
  onToggle?: () => void
  // Có quyền sửa thì truyền: nút "Sửa" hiện khi mục đang mở và chưa ở chế độ sửa
  onEdit?: () => void
  isEditing?: boolean
  // Câu ghi chú nhỏ ở chân card (ai sửa được, áp dụng cho đâu)
  footerNote?: string
  // Ô vuông góc dưới phải: quét QR, lấy vị trí, đặt lại mặc định
  footerTile?: SettingsTileAction
  children: ReactNode
}

// Khung một mục cài đặt theo ảnh mẫu dạng hoá đơn: ô icon lime + tên mục, nhãn phạm vi và nút "Sửa" góc trên phải,
// đường kẻ, phần thân (lưới thông tin, bảng, thanh đen), chân card có ghi chú và ô thao tác. Thu gọn thì chỉ còn đầu card
export function SettingsSection({
  icon: SectionIcon,
  title,
  subtitle,
  scopeLabel,
  isExpanded,
  onToggle,
  onEdit,
  isEditing = false,
  footerNote,
  footerTile,
  children,
}: SettingsSectionProps) {
  const palette = usePalette()
  const CaretIcon = isExpanded ? CaretUpIcon : CaretDownIcon
  const canShowEdit = isExpanded && !isEditing && Boolean(onEdit)

  return (
    <View style={[styles.card, { backgroundColor: palette.surface }]}>
      <Pressable
        style={styles.header}
        onPress={onToggle}
        disabled={!onToggle}
        accessibilityRole={onToggle ? 'button' : 'header'}
        accessibilityState={onToggle ? { expanded: isExpanded } : undefined}
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        <View style={[styles.iconTile, { backgroundColor: palette.primary }]}>
          <SectionIcon size={24} color={palette.onPrimary} />
        </View>
        <View style={styles.titles}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="small" color={palette.textSecondary} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.scope}>
          <Text
            variant="small"
            weight="semiBold"
            color={palette.textSecondary}
            style={styles.overline}
            numberOfLines={1}
          >
            {scopeLabel}
          </Text>
          {canShowEdit ? (
            <PressableScale
              onPress={onEdit}
              hitSlop={EDIT_HIT_SLOP}
              style={[styles.editButton, { borderColor: palette.text }]}
              accessibilityRole="button"
              accessibilityLabel={t('Sửa {section}', { section: title })}
            >
              <PencilSimpleIcon size={14} color={palette.text} weight="bold" />
              <Text variant="small" weight="semiBold">
                {t('Sửa')}
              </Text>
            </PressableScale>
          ) : isEditing ? (
            <Text variant="small" weight="semiBold">
              {t('Đang sửa')}
            </Text>
          ) : onToggle ? (
            <CaretIcon size={16} color={palette.textSecondary} weight="bold" />
          ) : null}
        </View>
      </Pressable>

      {isExpanded && (
        <>
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          <View style={styles.body}>{children}</View>
          {(footerNote || footerTile) && (
            <View style={styles.footer}>
              <Text variant="small" color={palette.textSecondary} style={styles.footerNote}>
                {footerNote ?? ''}
              </Text>
              {footerTile && <SettingsTileButton {...footerTile} />}
            </View>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconTile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  scope: { alignItems: 'flex-end', gap: Spacing.xs, maxWidth: '40%' },
  // Nhãn viết hoa giãn chữ như "INVOICE" trong ảnh mẫu
  overline: { textTransform: 'uppercase', letterSpacing: 1 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: BorderWidth.strong,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  divider: { height: BorderWidth.hairline * 2 },
  body: { gap: Spacing.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footerNote: { flex: 1 },
})
