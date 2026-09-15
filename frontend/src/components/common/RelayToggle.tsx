import { Toggle, Badge } from '@/components/ui'
import { useControlRelay } from '@/hooks/useDevices'
import type { RelayName, ControlMode } from '@/types'

interface RelayToggleProps {
  nodeId: string
  relayName: RelayName
  label: string
  checked: boolean
  mode: ControlMode
}

/** RelayToggle – bật/tắt relay thủ công + badge AUTO/MANUAL (ENV-FR-016, 017) */
export default function RelayToggle({ nodeId, relayName, label, checked, mode }: RelayToggleProps) {
  const controlRelay = useControlRelay()

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-charcoal">{label}</span>
        <Badge tone={mode === 'MANUAL' ? 'warning' : 'neutral'}>{mode}</Badge>
      </div>
      <Toggle
        checked={checked}
        disabled={controlRelay.isPending}
        onChange={state => controlRelay.mutate({ nodeId, relayName, state })}
        aria-label={label}
      />
    </div>
  )
}
