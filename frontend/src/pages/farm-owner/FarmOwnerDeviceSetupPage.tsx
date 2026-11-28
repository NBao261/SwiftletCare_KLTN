// Bộ điều khiển 4 bước, camera 3 bước (không cần AP/WiFi)
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import Stepper from '@/components/ui/Stepper'
import { Step1Location }   from '@/components/features/farm-owner/onboarding/Step1Location'
import { Step2Validate }   from '@/components/features/farm-owner/onboarding/Step2Validate'
import { Step3ConnectAP }  from '@/components/features/farm-owner/onboarding/Step3ConnectAP'
import { Step5WaitOnline } from '@/components/features/farm-owner/onboarding/Step5WaitOnline'
import type { OnboardingState } from '@/components/features/farm-owner/onboarding/onboardingTypes'
import { clearSetupProgress, isDeviceSetupState, loadSetupProgress, saveSetupProgress } from '@/components/features/farm-owner/onboarding/deviceSetupState'
import { DEVICE_LIST_PATH } from '@/components/features/farm-owner/devices/devices.constants'
import { usePageBack } from '@/hooks/common/useBreadcrumb'
import { useAllZones } from '@/hooks/shared/useFarms'
import { useAuthStore } from '@/stores/authStore'

// SENSOR_NODE: 4 bước; CAMERA_NODE: 3 bước (bỏ AP WiFi)
const SENSOR_STEPS  = ['Vị trí', 'Xác thực', 'Kết nối Wi-Fi', 'Đợi kết nối']
const CAMERA_STEPS  = ['Vị trí', 'Xác thực', 'Đợi kết nối']

const INITIAL_STATE: OnboardingState = {
  location:   {},
  deviceType: 'SENSOR_NODE',
  deviceId:   '',
  secretKey:  '',
  deviceDbId: '',
}

export default function FarmOwnerDeviceSetupPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const userId = useAuthStore(authState => authState.user?._id)
  // Mở từ trang Zone: vị trí đã chọn sẵn nên vào thẳng bước xác thực, và làm xong thì quay lại trang đó
  const preset = isDeviceSetupState(state) ? state : undefined
  const [step, setStep] = useState(preset ? 1 : 0)
  const [data, setData] = useState<OnboardingState>(preset ? { ...INITIAL_STATE, location: preset.location } : INITIAL_STATE)
  const [returnTo, setReturnTo] = useState(preset?.returnTo)
  // Thiết bị của chính người này đã đăng ký mà chưa xong (tải lại trang, hay rời đi giữa chừng): hỏi nối lại hay làm mới, không tự nối
  const [unfinished, setUnfinished] = useState(() => loadSetupProgress(userId))
  const leaveLabel = returnTo ? 'Quay lại Zone' : 'Về danh sách thiết bị'
  // Nút quay lại ở đầu trang ở mọi bước; đang thiết lập dở thì tiến trình vẫn giữ để nối lại lần sau
  usePageBack(returnTo ?? DEVICE_LIST_PATH, returnTo ? 'Zone' : 'Thiết bị')

  const patch = (partial: Partial<OnboardingState>) =>
    setData(prev => ({ ...prev, ...partial }))

  const next = useCallback(() => setStep(s => s + 1), [])
  const back = () => setStep(s => s - 1)

  const isCamera    = data.deviceType === 'CAMERA_NODE'
  const stepLabels  = isCamera ? CAMERA_STEPS : SENSOR_STEPS

  // Giữ tiến trình từ lúc thiết bị đã đăng ký (bước 3 và 4 chờ lâu, dễ bấm tải lại)
  useEffect(() => {
    if (data.deviceDbId && userId) saveSetupProgress({ userId, step, deviceType: data.deviceType, location: data.location, deviceId: data.deviceId, deviceDbId: data.deviceDbId, returnTo })
  }, [userId, step, data.deviceType, data.location, data.deviceId, data.deviceDbId, returnTo])

  function leave() {
    clearSetupProgress()
    navigate(returnTo ?? DEVICE_LIST_PATH)
  }

  // Nối lại thiết bị đang thiết lập dở ở đúng bước đã dừng
  function resume() {
    if (!unfinished) return
    const { step: savedStep, returnTo: savedReturnTo, userId: _savedUser, ...savedData } = unfinished
    setStep(savedStep)
    setData({ ...INITIAL_STATE, ...savedData })
    setReturnTo(savedReturnTo)
    setUnfinished(undefined)
  }

  function discardUnfinished() {
    clearSetupProgress()
    setUnfinished(undefined)
  }

  // Bắt đầu thiết lập khác khi đang làm dở
  function startOver() {
    clearSetupProgress()
    setStep(0)
    setData(INITIAL_STATE)
  }

  // Dòng vị trí đã chọn, hiện từ bước xác thực trở đi
  const { data: allZones } = useAllZones()
  const locationLabel = useMemo(() => {
    const { zoneId, houseId } = data.location
    const zone = allZones?.find(item => item._id === zoneId) ?? allZones?.find(item => item.house_id === houseId)
    if (!zone) return undefined
    return [zone.farmName, zone.houseName, !isCamera && zoneId ? zone.name : undefined].filter(Boolean).join(' · ')
  }, [allZones, data.location, isCamera])

  // Ánh xạ step index sang component theo loại thiết bị
  const lastStep   = stepLabels.length - 1
  const isWaitStep = step === lastStep

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-charcoal">Thiết lập thiết bị mới</h2>
        <p className="mt-0.5 text-sm text-warmGray">Hướng dẫn từng bước kết nối thiết bị vào hệ thống SwiftletCare</p>
        {step > 0 && locationLabel && (
          <p className="mt-2 text-sm font-semibold text-charcoal">
            Lắp tại: {locationLabel}
            {data.deviceDbId && (
              <button type="button" onClick={startOver} className="ml-3 font-normal text-warmGray underline hover:text-charcoal">
                Thiết lập thiết bị khác
              </button>
            )}
          </p>
        )}
      </div>

      {unfinished && !data.deviceDbId && (
        <Card className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-charcoal">
              Bạn đang thiết lập dở thiết bị <span className="font-semibold">{unfinished.deviceId}</span>: đã đăng ký nhưng chưa xong.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={resume}>Tiếp tục</Button>
              <Button size="sm" variant="secondary" onClick={discardUnfinished}>Bắt đầu mới</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stepper */}
      <Card className="!p-5">
        <Stepper steps={stepLabels} current={step} />
      </Card>

      {/* Step content */}
      <Card className="!p-6">
        <div key={step} className="animate-step-in motion-reduce:animate-none">
          {step === 0 && <Step1Location data={data} patch={patch} onNext={next} />}
          {step === 1 && <Step2Validate data={data} patch={patch} onNext={next} onBack={back} />}
          {/* SENSOR bước 2: AP+WiFi; CAMERA bỏ qua thẳng WaitOnline */}
          {!isCamera && step === 2 && <Step3ConnectAP data={data} onNext={next} onBack={back} />}
          {isWaitStep && (
            <Step5WaitOnline
              data={data}
              leaveLabel={leaveLabel}
              onSuccess={leave}
              onRetry={() => setStep(isCamera ? 1 : 2)}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
