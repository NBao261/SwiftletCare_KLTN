import { StyleSheet, Text as NativeText, type TextProps as NativeTextProps } from 'react-native'
import { FontFamily, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

export type TextVariant = keyof typeof Typography

interface TextProps extends NativeTextProps {
  variant?: TextVariant
  // Ghi đè nét chữ của variant
  weight?: keyof typeof FontFamily
  color?: string
  center?: boolean
}

// Mọi chữ trên giao diện đi qua đây để đúng font và cỡ chữ trong theme
export function Text({ variant = 'body', weight, color, center, style, ...props }: TextProps) {
  const palette = usePalette()

  return (
    <NativeText
      style={[
        Typography[variant],
        { color: color ?? palette.text },
        weight && { fontFamily: FontFamily[weight] },
        center && styles.center,
        style,
      ]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
})
