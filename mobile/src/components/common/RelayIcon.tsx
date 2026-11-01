import { DropIcon, FanIcon, SpeakerHighIcon } from 'phosphor-react-native'
import type { RelayName } from '@/types'

interface RelayIconProps {
  relay: RelayName
  color: string
}

// Icon theo loại relay: bơm phun sương → giọt nước, quạt → quạt, loa → loa
export function RelayIcon({ relay, color }: RelayIconProps) {
  if (relay === 'ventilation') return <FanIcon size={20} color={color} weight="bold" />
  if (relay === 'speaker') return <SpeakerHighIcon size={20} color={color} weight="bold" />
  return <DropIcon size={20} color={color} weight="bold" />
}
