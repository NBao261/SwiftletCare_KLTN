import { body, query, type ValidationChain } from 'express-validator'

// Giới hạn nhập chọn tay (Report 3 §4.5); route và service dùng chung, không chép số vào từng route
export const LIMITS = {
  address: 200,
  description: 500,
  fullName: 100,
  email: 254,
  reason: 500,
  secretKey: 128,
  pushToken: 512,
  url: 2048,
  passwordMin: 8,
  // Giới hạn của bcrypt: dài hơn thì bị cắt lặng lẽ
  passwordMax: 72,
  // Mật khẩu cũ có thể dài hơn mức mới; chỉ chặn chuỗi khổng lồ
  loginPasswordMax: 128,
  maxHarvestNests: 100_000,
  maxHarvestGrams: 1_000_000,
  maxHarvestImages: 5,
  maxBirdCount: 1_000_000,
  alertMessage: 500,
  alertRawBytes: 8 * 1024,
  firmwareVersion: 32,
  modelVersion: 64,
} as const

export const PHONE_PATTERN = /^[0-9 ()+-]{8,20}$/
// Mã đặt lại mật khẩu là 6 chữ số (auth.service)
export const RESET_CODE_PATTERN = /^\d{6}$/

// .isString() trước: express-validator coi mảng và object là hợp lệ với notEmpty/isEmail/isLength
export const emailField = (field = 'email'): ValidationChain =>
  body(field).isString().bail().trim().isLength({ max: LIMITS.email }).bail().isEmail()

export const newPasswordField = (field: string): ValidationChain =>
  body(field).isString().bail().isLength({ min: LIMITS.passwordMin, max: LIMITS.passwordMax })
    .withMessage(`Mật khẩu từ ${LIMITS.passwordMin} đến ${LIMITS.passwordMax} ký tự`)

export const loginPasswordField = (field: string): ValidationChain =>
  body(field).isString().bail().notEmpty().isLength({ max: LIMITS.loginPasswordMax })

// Lý do bắt buộc của một thao tác trên thiết bị hoặc tài khoản
export const reasonField = (field = 'reason'): ValidationChain =>
  body(field).isString().bail().trim().notEmpty().isLength({ max: LIMITS.reason })

export const optionalTextField = (field: string, max: number): ValidationChain =>
  body(field).optional().isString().bail().trim().isLength({ max })

// isISO8601 vẫn nhận '2026-W43' (Date không đọc được): kiểm thêm Date.parse
const isoInstant = (name: string, required: boolean): ValidationChain => {
  const chain = required ? query(name) : query(name).optional()
  return chain.isString().bail().isISO8601().bail()
    .custom((value: string) => !Number.isNaN(Date.parse(value))).withMessage(`${name} không phải ngày hợp lệ`)
}

// from, to cùng dạng ngày giờ ISO; from không sau to (trừ khi service đã trả 400 cho thứ tự sai: ordered = false)
export const isoRange = (required = false, ordered = true): ValidationChain[] => [
  isoInstant('from', required),
  isoInstant('to', required),
  ...(ordered ? [orderCheck()] : []),
]

const orderCheck = (): ValidationChain =>
  query('to').custom((to: unknown, { req }) => {
    const from: unknown = req.query?.from
    if (typeof from !== 'string' || typeof to !== 'string') return true
    const [fromMs, toMs] = [Date.parse(from), Date.parse(to)]
    return Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs <= toMs
  }).withMessage('from không được sau to')
