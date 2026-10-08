// otaTypes.ts — shared types + constants for OTA feature
// Không import React → fully tree-shakeable
//
// OTA thật: POST /devices/sensor-nodes/:id/commands { command:'OTA', ota:{version,url,sha256} }.
// BE KHÔNG có catalog firmware / % tiến trình — Technician nhập thủ công thông tin bản build (từ CI/CD),
// trạng thái chạy lấy từ chính SensorNode: `ota_pending` (đang chờ) / `ota_failed` (quá 30 phút, job BE).

export interface OtaFormValues {
  version: string
  url: string
  sha256: string
}

export const EMPTY_OTA_FORM: OtaFormValues = { version: '', url: '', sha256: '' }

/** Khớp validator BE: version x.y.z (không có tiền tố "v"), url https, sha256 hex 64 ký tự */
const VERSION_RE = /^\d+\.\d+\.\d+$/
const SHA256_RE = /^[a-fA-F0-9]{64}$/

export type OtaFormErrors = Partial<Record<keyof OtaFormValues, string>>

export function validateOtaForm(v: OtaFormValues): OtaFormErrors {
  const errors: OtaFormErrors = {}
  if (!VERSION_RE.test(v.version.trim())) errors.version = 'Phiên bản dạng x.y.z, VD 1.3.0 (không có chữ "v")'
  if (!/^https:\/\//i.test(v.url.trim())) {
    errors.url = 'URL phải bắt đầu bằng https://'
  } else {
    try { new URL(v.url.trim()) } catch { errors.url = 'URL không hợp lệ' }
  }
  if (!SHA256_RE.test(v.sha256.trim())) errors.sha256 = 'SHA-256 gồm đúng 64 ký tự hex'
  return errors
}

/** Trạng thái hiển thị của side panel — suy ra từ SensorNode + thao tác vừa gửi */
export type OTARunState = 'idle' | 'pending' | 'done' | 'failed'
