// OTAPage — F-TC-03 / Stitch A4 + B4 + B8
// OTA Firmware Management: layout + state management
// Logic hiển thị được tách sang ./components/
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { deviceApi } from '@/services/api'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { IconOTA } from '@/components/ui/icons'
import { DeviceTable }     from './components/DeviceTable'
import { OTASidePanel }   from './components/OTASidePanel'
import { OTAConfirmModal } from './components/OTAConfirmModal'
import { FIRMWARE_VERSIONS } from './components/otaTypes'
import type { FirmwareVersion, OTAError, OTARunState, OTAStepState } from './components/otaTypes'
import type { SensorNode } from '@/types'

export default function OTAPage() {
  const { data: nodes, isLoading } = useQuery({
    queryKey: ['sensor-nodes-ota'],
    queryFn: () => deviceApi.listSensorNodes().then(r => r.data.data),
  })

  const [selectedNode, setSelectedNode] = useState<SensorNode | null>(null)
  const [selectedFw, setSelectedFw] = useState<FirmwareVersion>(FIRMWARE_VERSIONS[0])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [otaState, setOtaState] = useState<OTARunState>('idle')
  const [otaError, setOtaError] = useState<OTAError>(null)
  const [otaSteps, setOtaSteps] = useState<OTAStepState[]>([])

  // Refs to track timers for cleanup on unmount (prevent memory leak)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [])

  function openPanel(node: SensorNode) {
    setSelectedNode(node)
    setOtaState('idle')
    setOtaError(null)
    setOtaSteps([])
  }

  function startOTA() {
    setConfirmOpen(false)
    setOtaState('progress')

    const steps: OTAStepState[] = [
      { label: 'Gửi lệnh tải firmware',    status: 'done' },
      { label: 'Đang tải firmware…',        status: 'active', progress: 0 },
      { label: 'Đang ghi vào thiết bị',    status: 'pending' },
      { label: 'Khởi động lại',            status: 'pending' },
      { label: 'Xác nhận thành công',      status: 'pending' },
    ]
    setOtaSteps(steps)

    // Simulate OTA progress — production sẽ dùng socket OTA_STATUS event
    let prog = 0
    intervalRef.current = setInterval(() => {
      prog += 10
      setOtaSteps(prev => prev.map((s, i) =>
        i === 1 ? { ...s, progress: Math.min(prog, 100) } : s,
      ))
      if (prog >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        const advance = (fromIdx: number, toIdx: number, delay: number) => {
          const t = setTimeout(() => {
            setOtaSteps(prev => prev.map((s, i) => {
              if (i === fromIdx) return { ...s, status: 'done' as const, progress: undefined }
              if (i === toIdx)   return { ...s, status: 'active' as const }
              return s
            }))
          }, delay)
          timeoutsRef.current.push(t)
        }

        advance(1, 2, 500)
        const t2 = setTimeout(() => advance(2, 3, 0), 2000)
        const t3 = setTimeout(() => advance(3, 4, 0), 3500)
        const t4 = setTimeout(() => {
          setOtaSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })))
          setOtaState('done')
        }, 5000)
        timeoutsRef.current.push(t2, t3, t4)
      }
    }, 200)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">OTA Firmware</h1>
        <p className="mt-0.5 text-sm text-warmGray">Cập nhật firmware không dây cho các thiết bị ESP32</p>
      </div>

      {/* 2-col layout: table + side panel */}
      <div className="flex gap-5">
        {/* Device table */}
        <div className="min-w-0 flex-1">
          {isLoading && <LoadingSkeleton count={4} className="h-14 w-full" />}

          {!isLoading && (!nodes || nodes.length === 0) && (
            <EmptyState
              icon={<IconOTA width={28} height={28} />}
              title="Không có thiết bị nào"
              description="Chưa có SensorNode nào được đăng ký trong hệ thống."
            />
          )}

          {!isLoading && nodes && nodes.length > 0 && (
            <DeviceTable
              nodes={nodes}
              selectedId={selectedNode?._id}
              onSelect={openPanel}
            />
          )}
        </div>

        {/* Side panel — slide in khi chọn node */}
        {selectedNode && (
          <div className="w-80 shrink-0 animate-[slideInRight_0.2s_ease-out]">
            <OTASidePanel
              node={selectedNode}
              selectedFw={selectedFw}
              onFwChange={setSelectedFw}
              onPush={() => setConfirmOpen(true)}
              otaState={otaState}
              otaSteps={otaSteps}
              otaError={otaError}
              onRetry={() => { setOtaState('idle'); setOtaError(null) }}
              onSimulateError={(err) => { setOtaState('error'); setOtaError(err) }}
            />
          </div>
        )}
      </div>

      {/* B4: OTA Confirm Modal */}
      {confirmOpen && selectedNode && (
        <OTAConfirmModal
          node={selectedNode}
          firmware={selectedFw}
          onClose={() => setConfirmOpen(false)}
          onConfirm={startOTA}
        />
      )}
    </div>
  )
}
