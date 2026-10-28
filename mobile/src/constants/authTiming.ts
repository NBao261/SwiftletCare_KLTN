// Mã đặt lại mật khẩu: 6 số, sống 15 phút — khớp RESET_TOKEN_TTL_MS ở backend/src/services/auth.service.ts
export const RESET_CODE_LENGTH = 6
export const RESET_CODE_LIFETIME_MS = 15 * 60 * 1000

// Chờ giữa hai lần gửi lại mã ở máy, để không chạm giới hạn 10 lần / 15 phút của backend
export const RESEND_CODE_COOLDOWN_SECONDS = 60
