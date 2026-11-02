/**
 * Bảng màu nhận diện thương hiệu của SwiftletCare (mobile)
 * Bảng màu thiết kế (đổi theo yêu cầu 2026-10-30):
 * - #C3FD47: Lime — điểm nhấn; CHỈ làm nền (nút chính, nút tròn giữa, badge) hoặc chữ/icon trên nền Ink
 * - #0B0B0C: Ink — chữ chính, khối tối (thanh tab, card nổi bật)
 * - #F3F3EE: Paper — nền màn hình
 * - #FFFFFF: Trắng — card, ô nhập
 * - #FF7426: Cam an toàn (Safety Orange) — CHỈ cho cảnh báo, lỗi, khẩn cấp
 * Màu trạng thái (mức độ, trạng thái cảnh báo, thiết bị, loại yến) lấy đúng của web (frontend/tailwind.config.ts).
 */
// App chỉ có giao diện sáng — không có bảng màu tối
export const Colors = {
  light: {
    // Lime chỉ làm NỀN: không dùng primary làm màu chữ/viền trên nền sáng (Paper, trắng) — dùng text
    primary: "#C3FD47",         // Lime — nền nút chính, nút tròn giữa, badge (đổi theo yêu cầu)
    onPrimary: "#0B0B0C",       // Ink — chữ/icon trên nền lime (đổi theo yêu cầu)
    secondary: "#0B0B0C8C",     // Ink mờ 55% — icon trung tính (đổi theo yêu cầu)
    alert: "#FF7426",           // Safety Orange — chỉ cảnh báo/lỗi, không dùng cho nút
    onAlertTint: "#FFFFFF33",   // Trắng mờ 20% — nền vòng icon và nhãn trên khung cảnh báo khẩn (thêm theo yêu cầu)
    text: "#0B0B0C",            // Ink — chữ chính (đổi theo yêu cầu)
    textSecondary: "#0B0B0C8C", // Ink mờ 55% — chữ giải thích (đổi theo yêu cầu)
    background: "#F3F3EE",      // Paper — nền màn hình (đổi theo yêu cầu)
    surface: "#FFFFFF",         // Trắng — nền card, ô nhập (đổi theo yêu cầu)
    surfaceStrong: "#F3F3EE",   // Paper — khối nền bên trong card trắng (đổi theo yêu cầu)
    border: "#0B0B0C1A",        // Ink mờ 10% — viền mảnh (đổi theo yêu cầu)
    divider: "#0B0B0C14",       // Ink mờ 8% — đường kẻ mảnh chia dòng, chia khối (đổi theo yêu cầu)
    inverse: "#0B0B0C",         // Ink — khối tối: card nổi bật (thêm theo yêu cầu)
    onInverse: "#FFFFFF",       // Chữ trên khối tối (thêm theo yêu cầu)
    onInverseSecondary: "#FFFFFF8C", // Trắng mờ 55% — chữ phụ trên khối tối (thêm theo yêu cầu)
    tint: "#C3FD47",            // Lime (đổi theo yêu cầu)
    tabIconDefault: "#0B0B0C8C",  // Ink mờ 55% — tab chưa chọn, trên thanh trắng (đổi theo yêu cầu)
    tabIconSelected: "#0B0B0C",   // Ink — icon và chữ tab đang chọn (đổi theo yêu cầu)

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
    houseHealthy: "#446401",    // Nhà yến ổn — chấm xanh trên thẻ nhà ở Trang chủ (thêm theo yêu cầu)

    // Trang chủ — token riêng cho phần trang trí và lớp phủ, cùng mã màu đã duyệt (thêm theo yêu cầu 2026-10-31)
    farmRingOuter: "#414C1073",       // Olive mờ 45% — vòng ngoài trên card Farm
    farmRingInner: "#414C10CC",       // Olive mờ 80% — vòng trong trên card Farm
    houseRingOuter: "#0B0B0C14",      // Ink mờ 8% — vòng ngoài trên thẻ nhà yến
    houseRingInner: "#0B0B0C29",      // Ink mờ 16% — vòng trong trên thẻ nhà yến
    reportLabel: "#414C10",           // Olive — icon và nhãn "BÁO CÁO MỚI"
    notificationBadge: "#D53F35",     // Đỏ — badge số trên chuông thông báo
    urgentAlertGradientEnd: "#D53F35",// Đỏ — cuối dải loang của khung cảnh báo khẩn (đầu dải là alert)
    videoControlBackdrop: "#0B0B0C8C",// Ink mờ 55% — nền nút tròn trên video
    videoFlashBackdrop: "#0B0B0C99",  // Ink mờ 60% — nền chữ báo khi chạm đúp video
    videoInfoBackdrop: "#0B0B0CCC",   // Ink mờ 80% — nền bảng thông tin camera trên video
    videoDim: "#0B0B0C59",            // Ink mờ 35% — lớp tối phủ video khi hiện điều khiển
  },
  // Các mã màu thuần túy (Raw Hex) để lập trình viên sử dụng bất kỳ đâu
  raw: {
    lime: "#C3FD47",
    ink: "#0B0B0C",
    paper: "#F3F3EE",
    pureWhite: "#FFFFFF",
    safetyOrange: "#FF7426",
    successLime: "#B5D32C",
    alertRed: "#D53F35",
  }
} as const;

export type AppColors = typeof Colors;

// Bo góc theo ảnh mẫu (đổi theo yêu cầu 2026-10-30) — không còn khung vuông góc
export const Radius = {
  sm: 8,      // khối nhỏ bên trong card (dòng tiêu đề bảng), checkbox
  md: 16,     // ô hành động nhanh, dòng danh sách, khối nhấn trong card, ô mã số
  lg: 24,     // card, card tối nổi bật, sheet, hộp thoại, khối logo icon, góc thanh tab
  full: 999,  // nút bấm, ô nhập, nút tròn icon, avatar, badge, chip
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
  button: { fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20 },                           // chữ trên nút — đậm theo yêu cầu
} as const;
