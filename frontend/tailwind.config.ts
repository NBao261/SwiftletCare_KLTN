import type { Config } from 'tailwindcss'

// SwiftletCare Design System — xem FE_Design_Claude.md (nguồn sự thật duy nhất
// cho màu sắc/bo góc/typography, §2 + §11.1). Thang màu số (gray/lime/accent/
// orange/red) bám đúng giá trị hex của doc. Các tên ngữ nghĩa cũ (charcoal,
// warmGray, graphite, limeMist, alertRed, climateOrange, stone, white) được
// giữ lại làm alias trỏ đúng vào 1 bậc của thang số — tránh phải đổi tên class
// ở hàng chục file đang dùng, hex vẫn khớp 100% với doc. Không tự thêm màu
// ngoài thang này (nguyên tắc 2, mục 1 FE_Design_Claude.md).
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Thang số đúng theo FE_Design_Claude.md §2.2/§11.1 ─────────────
        gray: {
          0: '#FFFFFF', 50: '#F9F9F9', 100: '#F0F0F0', 200: '#EAEAEA',
          300: '#C5C4C3', 400: '#A5A3A1', 500: '#878380', 600: '#6D6865',
          700: '#4E4A46', 800: '#393430', 900: '#27231F', 950: '#000000',
        },
        lime: {
          50: '#FDFFF3', 100: '#FAFFE6', 200: '#F5FFD0', 300: '#ECFFA9',
          400: '#DFFD73', 500: '#D2F93A', 600: '#BEEC08', 700: '#8FAF08',
          800: '#677E09', 900: '#445407',
        },
        accent: {
          50: '#F9FBEE', 100: '#F0F6D5', 200: '#E6F0B7', 300: '#D5E688',
          400: '#CCE170', 500: '#C6DD5D', 600: '#B5D32C', 700: '#89A022',
          800: '#627218', 900: '#414C10',
        },
        orange: {
          50: '#FDF3ED', 100: '#FAE1D1', 200: '#F6CAAC', 300: '#F3B287',
          400: '#EF9A62', 500: '#ED8F50', 600: '#E87121', 700: '#B95613',
          800: '#8B400E', 900: '#612D0A',
        },
        red: {
          50: '#FBEFEE', 100: '#F6D7D5', 200: '#EFB7B3', 300: '#E68F89',
          400: '#DC5E56', 500: '#D53F35', 600: '#B12E25', 700: '#87231C',
          800: '#611914', 900: '#44110E',
        },

        // ── Alias ngữ nghĩa (giữ tên cũ, hex trỏ đúng thang trên) ─────────
        white:         '#FFFFFF', // = gray-0 — nền mặc định toàn bộ màn hình & card / chữ trên nền tối
        charcoal:      '#27231F', // = gray-900 — Chữ chính / Nút primary / Track toggle ON
        graphite:      '#4E4A46', // = gray-700 — Card xám đậm phụ / Track toggle OFF
        warmGray:      '#878380', // = gray-500 — Chữ phụ / Border opacity / Label caption
        limeMist:      '#ECFFA9', // = lime-300 — Bề mặt nhạt: nền icon-box/chip/active pill icon
        success:       '#B5D32C', // = accent-600 — Trạng thái an toàn/ONLINE/đã kết nối (status dot)
        climateOrange: '#ED8F50', // = orange-500 — Cảnh báo vi khí hậu / quá nhiệt
        alertRed:      '#D53F35', // = red-500 — Cảnh báo khẩn cấp / badge mặc định
        stone:         '#EAEAEA', // = gray-200 — Canvas nền app shell (MainLayout)
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
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
