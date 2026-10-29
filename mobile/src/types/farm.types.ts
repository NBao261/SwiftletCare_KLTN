import type { Role } from './auth.types'

// Thành viên farm: FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia; member cũ không có role → đồng sở hữu
export interface FarmMember {
  user_id: string
  is_primary: boolean
  role?: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
  joined_at: string
}

export interface Farm {
  _id: string
  name: string
  address: string
  coordinates?: { lat: number; lng: number }
  owner_id: string
  members: FarmMember[]
  created_at: string
}

export interface House {
  _id: string
  farm_id: string
  name: string
  floors: number
  description?: string
}

export interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  nh3_max: number
  co2_max: number
}

export interface Zone {
  _id: string
  house_id: string
  name: string
  floor: number
  thresholds: Thresholds
}
