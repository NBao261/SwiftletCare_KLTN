// otaTypes.ts — shared types + constants for OTA feature
// Không import React → fully tree-shakeable

export const FIRMWARE_VERSIONS = [
  {
    version: 'v1.3.0',
    date: '19/09/2026',
    changelog: [
      'Sửa lỗi RS485 timeout khi poll ≥ 5 địa chỉ',
      'Giảm độ trễ MQTT heartbeat từ 30s → 15s',
      'Thêm watchdog timer tự động reboot khi boot loop',
    ],
  },
  {
    version: 'v1.2.4',
    date: '01/09/2026',
    changelog: [
      'Hotfix lỗi memory leak trong audio player',
      'Tối ưu sleep mode để giảm nhiệt',
    ],
  },
] as const

export type FirmwareVersion = (typeof FIRMWARE_VERSIONS)[number]

export type OTAError = 'DOWNLOAD_TIMEOUT' | 'CHECKSUM_MISMATCH' | 'ROLLBACK' | null

export type OTAStepState = {
  label: string
  status: 'done' | 'active' | 'pending'
  progress?: number // 0-100, chỉ khi active
}

export type OTARunState = 'idle' | 'progress' | 'done' | 'error'
