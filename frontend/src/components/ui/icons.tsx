import type { SVGProps } from 'react'

/**
 * Bộ icon nội bộ — SVG stroke dùng `currentColor` nên tự ăn theo màu chữ, không
 * thêm màu ngoài 8 màu chuẩn (FE_Design_Swiftlet.md §1). Không dùng thư viện
 * icon ngoài để giữ bundle nhẹ và kiểm soát được nét vẽ đồng nhất (stroke 1.6).
 */
type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}><rect x="2.5" y="2.5" width="6" height="7.5" rx="2" /><rect x="11.5" y="2.5" width="6" height="4.5" rx="2" /><rect x="11.5" y="10" width="6" height="7.5" rx="2" /><rect x="2.5" y="12.5" width="6" height="5" rx="2" /></Svg>
)

export const IconFarm = (p: IconProps) => (
  <Svg {...p}><path d="M3 8.5 10 3l7 5.5" /><path d="M4.5 8v9h11V8" /><path d="M8.5 17v-4.5h3V17" /></Svg>
)

export const IconDevice = (p: IconProps) => (
  <Svg {...p}><rect x="4.5" y="2.5" width="11" height="15" rx="3" /><path d="M8 6h4" /><circle cx="10" cy="13" r="1.5" /></Svg>
)

export const IconAlert = (p: IconProps) => (
  <Svg {...p}><path d="M10 2.6 2.8 15.4a1.2 1.2 0 0 0 1 1.8h12.4a1.2 1.2 0 0 0 1-1.8Z" /><path d="M10 7.8v3.6" /><path d="M10 14.3h.01" /></Svg>
)

export const IconAnalytics = (p: IconProps) => (
  <Svg {...p}><path d="M3 17h14" /><path d="M5.5 17v-5" /><path d="M10 17V5" /><path d="M14.5 17v-8" /></Svg>
)

export const IconTicket = (p: IconProps) => (
  <Svg {...p}><path d="M3 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 5.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-2a2.5 2.5 0 0 0 0-5Z" /><path d="M12 4.5v11" strokeDasharray="2 2" /></Svg>
)

export const IconHarvest = (p: IconProps) => (
  <Svg {...p}><path d="M10 17c0-4.5 2.2-7.5 6-8.5-.4 4.6-2.6 7.3-6 8.5Z" /><path d="M10 17c0-4.5-2.2-7.5-6-8.5.4 4.6 2.6 7.3 6 8.5Z" /><path d="M10 17v-3" /></Svg>
)

export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" /></Svg>
)

export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M10 2.5A5.25 5.25 0 0 0 4.75 7.75v2.6l-1.2 2.2c-.3.55.1 1.2.72 1.2h11.46c.62 0 1.02-.65.72-1.2l-1.2-2.2v-2.6A5.25 5.25 0 0 0 10 2.5Z" /><path d="M8.2 16a1.8 1.8 0 0 0 3.6 0" /></Svg>
)

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}><path d="m5.5 8 4.5 4.5L14.5 8" /></Svg>
)

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="m8 5.5 4.5 4.5L8 14.5" /></Svg>
)

export const IconLogout = (p: IconProps) => (
  <Svg {...p}><path d="M7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3h3" /><path d="m12.5 13.5 3.5-3.5-3.5-3.5" /><path d="M16 10H7" /></Svg>
)

export const IconMenu = (p: IconProps) => (
  <Svg {...p}><path d="M3 6h14M3 10h14M3 14h14" /></Svg>
)

export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="m5 5 10 10M15 5 5 15" /></Svg>
)

export const IconPin = (p: IconProps) => (
  <Svg {...p}><path d="M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Z" /><circle cx="10" cy="8.5" r="2" /></Svg>
)

// ── Icon cho từng chỉ số cảm biến (ENV-FR-003) ─────────────────────────────
export const IconTemp = (p: IconProps) => (
  <Svg {...p}><path d="M8 11.2V4.5a2 2 0 1 1 4 0v6.7a4 4 0 1 1-4 0Z" /><path d="M10 8v4.5" /></Svg>
)

export const IconHumidity = (p: IconProps) => (
  <Svg {...p}><path d="M10 2.8s5 5.2 5 8.4a5 5 0 0 1-10 0c0-3.2 5-8.4 5-8.4Z" /></Svg>
)

export const IconLight = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.8M10 15.7v1.8M17.5 10h-1.8M4.3 10H2.5M15.3 4.7l-1.3 1.3M6 14l-1.3 1.3M15.3 15.3 14 14M6 6 4.7 4.7" /></Svg>
)

export const IconGas = (p: IconProps) => (
  <Svg {...p}><path d="M5 13.5c0-2.5 2-3.2 2-5.5 0-1.4-.6-2.4-.6-2.4s3.4.9 3.4 4.3c0 1 .6 1.6 1.2 1.6.9 0 1.4-.9 1.2-2 1.4 1.1 2.3 2.6 2.3 4a5.5 5.5 0 0 1-11 0Z" /></Svg>
)

export const IconSound = (p: IconProps) => (
  <Svg {...p}><path d="M4 8v4M7.5 5.5v9M11 3.5v13M14.5 7v6M18 9v2" /></Svg>
)
