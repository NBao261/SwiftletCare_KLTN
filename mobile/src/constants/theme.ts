/**
 * Bảng màu nhận diện thương hiệu của SwiftletCare (mobile)
 * Bảng màu thiết kế:
 * - #FFFFFF: Trắng tinh khiết (Pure White / nền)
 * - #CBCBCB: Xám nhạt (Light Gray / viền, khung ảnh, nền ô)
 * - #343434: Than đậm (Dark Charcoal / chữ chính)
 * - #9D9D9D: Xám trung tính (Medium Gray / chữ phụ, icon chưa chọn)
 * - #FF7426: Cam an toàn (Safety Orange) — CHỈ cho cảnh báo, lỗi, khẩn cấp
 * - #446401: Xanh thương hiệu — thay cho mọi điểm nhấn cam của mẫu (nút CTA, tab đang chọn, badge số, nhãn nhỏ)
 * Màu trạng thái (mức độ, trạng thái cảnh báo, thiết bị, loại yến) lấy đúng của web (frontend/tailwind.config.ts).
 */
// App chỉ có giao diện sáng — không có bảng màu tối
export const Colors = {
  light: {
    primary: "#446401",         // Brand Green — điểm nhấn duy nhất
    onPrimary: "#FFFFFF",       // Chữ trên nền xanh
    secondary: "#9D9D9D",       // Medium Gray
    alert: "#FF7426",           // Safety Orange — chỉ cảnh báo/lỗi, không dùng cho nút
    text: "#343434",            // Dark Charcoal — chữ chính
    textSecondary: "#9D9D9D",   // Medium Gray — chữ phụ
    background: "#FFFFFF",      // Pure White
    surface: "#CBCBCB33",       // Light Gray mờ 20% — nền ô/card
    surfaceStrong: "#CBCBCB",   // Light Gray — khung ảnh, khối nền lớn
    border: "#CBCBCB",          // Light Gray — viền nút outline, ô nhập
    divider: "#CBCBCB80",       // Light Gray mờ 50% — đường kẻ mảnh chia dòng, chia khối
    tint: "#446401",            // Brand Tint
    tabIconDefault: "#9D9D9D",  // Tab chưa chọn
    tabIconSelected: "#446401", // Tab đang chọn

    // 3 Mức độ cảnh báo (Severities) — nền + chữ badge, cùng web (frontend/src/constants/severity.ts)
    severityP1: "#FF7426",      // Khẩn cấp (Safety Orange)
    severityP1Text: "#FFFFFF",  // Chữ trắng
    severityP2: "#FAE1D1",      // Cao (Orange 100)
    severityP2Text: "#8B400E",  // Chữ cam đậm (Orange 800)
    severityP3: "#87838026",    // Thường (Warm Gray mờ 15%)
    severityP3Text: "#878380",  // Chữ xám ấm (Warm Gray)

    // 3 Loại yến thu hoạch (Harvest Types)
    nestWhite: "#B5D32C",       // Yến trắng
    nestPink: "#89A022",        // Yến hồng
    nestBlood: "#414C10",       // Yến huyết

    // Trạng thái xử lý cảnh báo — cùng web (infoBlue, limeMist, warmGray, statusYellow trong frontend/tailwind.config.ts)
    statusNew: "#4A89EB",       // Mới
    statusInProgress: "#B5D32C",// Đang xử lý
    statusResolved: "#878380",  // Đã xử lý
    statusWait: "#FFE033",      // Chờ kết nối PLC

    // Trạng thái thiết bị — chấm màu, cùng web (frontend/src/components/common/StatusDot.tsx)
    deviceOnline: "#B5D32C",    // Online
    deviceOffline: "#A5A3A1",   // Offline
    deviceError: "#D53F35",     // Lỗi (Alert Red)
    deviceDegraded: "#ED8F50",  // Suy giảm
    devicePending: "#F3B287",   // Chờ kết nối
  },
  // Các mã màu thuần túy (Raw Hex) để lập trình viên sử dụng bất kỳ đâu
  raw: {
    brandPrimary: "#446401",
    pureWhite: "#FFFFFF",
    lightGray: "#CBCBCB",
    mediumGray: "#9D9D9D",
    darkCharcoal: "#343434",
    safetyOrange: "#FF7426",
    successLime: "#B5D32C",
    alertRed: "#D53F35",
  }
} as const;

export type AppColors = typeof Colors;

// Bo góc — ảnh và ô nội dung vuông góc, nút bấm bo tròn hết cỡ (theo ảnh mẫu)
export const Radius = {
  none: 0,    // khung ảnh, ô nội dung, card
  sm: 4,      // ô nhập, checkbox
  md: 12,     // sheet, hộp thoại
  lg: 24,     // khối logo icon (splash)
  full: 999,  // nút bấm, nút tròn icon, badge, chip
} as const;

// Độ dày viền — giao diện phẳng, không dùng đổ bóng
export const BorderWidth = {
  hairline: 0.5, // đường kẻ chia dòng
  regular: 1,    // ô nhập
  strong: 1.5,   // nút outline
} as const;

// Khoảng cách — lề màn hình dùng lg (16)
export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Font Plus Jakarta Sans (cùng web) — mỗi nét một file trong assets/fonts, Android không tự chọn nét theo fontWeight
export const FontFamily = {
  regular: "PlusJakartaSans-Regular",   // 400
  medium: "PlusJakartaSans-Medium",     // 500
  semiBold: "PlusJakartaSans-SemiBold", // 600
  bold: "PlusJakartaSans-Bold",         // 700
} as const;

// Cỡ chữ — tiêu đề nét vừa, giãn chữ -2% như ảnh mẫu
export const Typography = {
  display: { fontFamily: FontFamily.medium, fontSize: 48, lineHeight: 52, letterSpacing: -0.96 }, // tiêu đề rất lớn ("CART")
  title: { fontFamily: FontFamily.medium, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },   // tiêu đề màn, số lớn ("€ 104")
  heading: { fontFamily: FontFamily.medium, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },  // tên mục, tên khối
  body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },                          // nội dung
  small: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },                         // mô tả, giá trị phụ
  label: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },                          // nhãn nhấn màu primary ("Tech Specs")
  button: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20 },                         // chữ trên nút
} as const;
