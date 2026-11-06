// Dữ liệu mẫu cho mục Report 3 đã có màn mà backend chưa có route (xem Known debt trong mobile/CLAUDE.md).
// Bật bằng EXPO_PUBLIC_USE_MOCK_API=true, mặc định bật khi chạy dev. Tắt thì các khối đó hiện "Sắp có".
// Dữ liệu mẫu luôn kèm nhãn "Dữ liệu mẫu" (components/common/MockDataBadge.tsx), không trình bày như số thật
export const IS_MOCK_API_ENABLED =
  process.env.EXPO_PUBLIC_USE_MOCK_API === undefined ? __DEV__ : process.env.EXPO_PUBLIC_USE_MOCK_API === 'true'

// Thời gian trả lời giả để màn có trạng thái tải như khi gọi mạng thật
export const MOCK_DELAY_MS = 400
