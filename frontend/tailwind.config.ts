import type { Config } from 'tailwindcss'

// SwiftletCare Design System — xem FE_Design_Swiftlet.md (nguồn sự thật duy nhất
// cho màu sắc/bo góc/typography). CHỈ dùng 8 màu định nghĩa dưới đây, không phối
// thêm màu ngoài bảng.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white:         '#FFFFFF', // Nền mặc định toàn bộ màn hình & card / chữ trên nền tối
        charcoal:      '#27231F', // Chữ chính / Nút primary / Track toggle ON
        limeMist:      '#ECFFA9', // Accent duy nhất — Active card / Badge / Swipe thumb
        graphite:      '#4E4A46', // Card xám đậm phụ / Track toggle OFF
        warmGray:      '#878380', // Chữ phụ / Border opacity / Label caption
        climateOrange: '#F0813A', // Cảnh báo vi khí hậu / trạng thái climate active
        alertRed:      '#E13A3A', // Cảnh báo khẩn cấp / Live
        insightPeach:  '#F5C89E', // Series phụ trên biểu đồ phân tích
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        xl:   '16px',
        '2xl': '20px',
        '3xl': '28px',
        full: '999px',
      },
      boxShadow: {
        card: '0 8px 24px rgba(39,35,31,0.06)',
        dock: '0 12px 32px rgba(39,35,31,0.12)',
        icon: '0 2px 8px rgba(39,35,31,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
}

export default config
