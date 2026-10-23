import type { Role } from '@/types'

export interface RelayOverrideLogItem {
  _id: string
  node_id: string
  device_id?: string
  relay_name: 'MISTING' | 'VENTILATION' | 'EXHAUST' | 'SPEAKER' | string
  state: boolean
  duration_ms: number
  overridden_by: { _id: string; full_name: string; role: Role } | string
  started_at: string
  expires_at: string
  is_active: boolean
}
