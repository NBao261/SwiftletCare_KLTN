/**
 * Mock Fallback — Màn hình 01_Expert_Dashboard_v3
 * ENV-FR-019 | SRS v2.1.4
 */
import type { RelayOverrideLogItem } from '@/types/expert.types'

export const MOCK_RELAY_OVERRIDES: RelayOverrideLogItem[] = [
  {
    _id: 'log_ovr_001',
    node_id: 'node_001',
    device_id: 'node_001',
    relay_name: 'MISTING',
    state: true,
    duration_ms: 15 * 60_000,
    overridden_by: {
      _id: 'user_farm_01',
      full_name: 'Trần Văn Hưng (Chủ nhà yến)',
      role: 'FARM_OWNER',
    },
    started_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    expires_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    is_active: false,
  },
  {
    _id: 'log_ovr_002',
    node_id: 'node_001',
    device_id: 'node_001',
    relay_name: 'VENTILATION',
    state: true,
    duration_ms: 30 * 60_000,
    overridden_by: {
      _id: 'user_farm_02',
      full_name: 'Nguyễn Văn An (Chủ nhà yến)',
      role: 'FARM_OWNER',
    },
    started_at: new Date(Date.now() - 120 * 60_000).toISOString(),
    expires_at: new Date(Date.now() - 90 * 60_000).toISOString(),
    is_active: false,
  },
]
