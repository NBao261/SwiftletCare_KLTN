import { Toggle, Badge } from '@/components/ui'
import { useControlRelay } from '@/hooks/shared/useDevices'
import { usePermission } from '@/hooks/common/usePermission'
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
  // Backend: POST /devices/sensor-nodes/:id/relay chỉ cho FARM_OWNER, TECHNICIAN, ADMIN
  const canControl = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-stone/30 rounded-xl border border-warmGray/10 hover:border-primary/20 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-charcoal whitespace-nowrap">{label}</span>
        <Badge tone={mode === 'MANUAL' ? 'warning' : 'neutral'} className="text-[10px] scale-90 origin-left">{mode}</Badge>
      </div>
      <div className="flex justify-end">
        <Toggle
          checked={checked}
          disabled={!canControl || controlRelay.isPending}
          onChange={state => controlRelay.mutate({ nodeId, relayName, state })}
          aria-label={label}
        />
      </div>
    </div>
  )
}
