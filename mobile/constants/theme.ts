/**
 * SwiftletCare Design System – Mobile
 * Consistent colors, spacing, typography across all screens.
 */

export const Colors = {
  // Brand – Teal palette (matching frontend TailwindCSS config)
  primary:    { 50:'#F0FDFA', 100:'#CCFBF1', 200:'#99F6E4', 300:'#5EEAD4', 400:'#2DD4BF', 500:'#14B8A6', 600:'#0D9488', 700:'#0F766E', 800:'#115E59', 900:'#134E4A' },
  // Semantic
  success:    '#22C55E',
  warning:    '#EAB308',
  error:      '#EF4444',
  info:       '#3B82F6',
  // Severity (SRS §ALERT-FR-001)
  severity:   { CRITICAL:'#DC2626', HIGH:'#EA580C', MEDIUM:'#EAB308', LOW:'#3B82F6' },
  // Device status
  device:     { ONLINE:'#22C55E', OFFLINE:'#9CA3AF', ERROR:'#EF4444', DEGRADED:'#EAB308' },
  // Neutral
  gray:       { 50:'#F9FAFB', 100:'#F3F4F6', 200:'#E5E7EB', 300:'#D1D5DB', 400:'#9CA3AF', 500:'#6B7280', 600:'#4B5563', 700:'#374151', 800:'#1F2937', 900:'#111827', 950:'#030712' },
  // System
  white:      '#FFFFFF',
  black:      '#000000',
  background: { light:'#F9FAFB', dark:'#030712' },
  surface:    { light:'#FFFFFF', dark:'#111827' },
  border:     { light:'#E5E7EB', dark:'#374151' },
} as const

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48,
} as const

export const Radius = {
  sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, full: 9999,
} as const

export const FontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36,
} as const

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
}

export const Shadow = {
  sm: { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:2, elevation:1 },
  md: { shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.1,  shadowRadius:4, elevation:3 },
  lg: { shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:8, elevation:6 },
} as const
