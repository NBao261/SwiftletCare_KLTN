import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  offDeviceStatusChange,
  offRelayUpdate,
  onDeviceStatusChange,
  onRelayUpdate,
} from '@/services/socket/socketClient'

// Relay đổi trạng thái hoặc thiết bị online/offline (RELAY_UPDATE, DEVICE_STATUS_CHANGE) thì tải lại danh sách thiết bị.
// Payload không có id controller nên không ghép thẳng vào cache; phòng zone/nhà do hook số đo và số đếm chim đã vào
export function useDeviceStream() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const refreshDevices = () => {
      queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['devices', 'camera-nodes'] })
    }
    onRelayUpdate(refreshDevices)
    onDeviceStatusChange(refreshDevices)
    return () => {
      offRelayUpdate(refreshDevices)
      offDeviceStatusChange(refreshDevices)
    }
  }, [queryClient])
}
