// OnboardingPage — FARM-FR-003, 004, 007, 012
// SENSOR_NODE: 4 bước (Vị trí → Xác thực → Kết nối AP+WiFi → Đợi kết nối)
// CAMERA_NODE:  3 bước (Vị trí → Xác thực → Đợi kết nối) — không cần AP/WiFi step
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import Stepper from '@/components/ui/Stepper'
import { Step1Location }   from '@/components/features/technician/onboarding/Step1Location'
import { Step2Validate }   from '@/components/features/technician/onboarding/Step2Validate'
import { Step3ConnectAP }  from '@/components/features/technician/onboarding/Step3ConnectAP'
import { Step5WaitOnline } from '@/components/features/technician/onboarding/Step5WaitOnline'
import type { OnboardingState } from '@/components/features/technician/onboarding/onboardingTypes'

// SENSOR_NODE: 4 bước; CAMERA_NODE: 3 bước (bỏ AP WiFi)
const SENSOR_STEPS  = ['Vị trí', 'Xác thực', 'Kết nối AP & WiFi', 'Đợi kết nối']
const CAMERA_STEPS  = ['Vị trí', 'Xác thực', 'Đợi kết nối']

const INITIAL_STATE: OnboardingState = {
  location:   {},
  deviceType: 'SENSOR_NODE',
  deviceId:   '',
  secretKey:  '',
  deviceDbId: '',
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingState>(INITIAL_STATE)

  const patch = (partial: Partial<OnboardingState>) =>
    setData(prev => ({ ...prev, ...partial }))

  const next = useCallback(() => setStep(s => s + 1), [])
  const back = () => setStep(s => s - 1)

  const isCamera    = data.deviceType === 'CAMERA_NODE'
  const stepLabels  = isCamera ? CAMERA_STEPS : SENSOR_STEPS

  // Ánh xạ step index sang component:
  //   0 → Location
  //   1 → Validate
  //   SENSOR 2 → ConnectAP (gộp AP + WiFi guide)
  //   SENSOR 3 → WaitOnline
  //   CAMERA 2 → WaitOnline
  const lastStep   = stepLabels.length - 1
  const isWaitStep = step === lastStep

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Lắp đặt thiết bị mới</h1>
        <p className="mt-0.5 text-sm text-warmGray">Hướng dẫn từng bước kết nối ESP32 vào hệ thống SwiftletCare</p>
      </div>

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
              onSuccess={() => navigate('/devices')}
              onRetry={() => setStep(isCamera ? 1 : 2)}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
