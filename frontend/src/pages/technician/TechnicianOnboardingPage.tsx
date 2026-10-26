// OnboardingPage — F-TC-01 / Stitch A3 + B5 + B6 + B7 + B9 + C1
// Wizard 5 bước lắp đặt thiết bị ESP32 — shell + state only
// Logic từng bước được tách sang ./steps/
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import Stepper from '@/components/ui/Stepper'
import { Step1Location }   from '@/components/features/technician/onboarding/Step1Location'
import { Step2Validate }   from '@/components/features/technician/onboarding/Step2Validate'
import { Step3ConnectAP }  from '@/components/features/technician/onboarding/Step3ConnectAP'
import { Step4WiFi }       from '@/components/features/technician/onboarding/Step4WiFi'
import { Step5WaitOnline } from '@/components/features/technician/onboarding/Step5WaitOnline'
import type { OnboardingState } from '@/components/features/technician/onboarding/onboardingTypes'

// ── Wizard Stepper ─────────────────────────────────────────────────────────────
const STEP_LABELS = ['Vị trí', 'Thiết bị', 'Kết nối AP', 'WiFi farm', 'Đợi MQTT']

// ── Page ──────────────────────────────────────────────────────────────────────
const INITIAL_STATE: OnboardingState = {
  location:   {},
  deviceType: 'SENSOR_NODE',
  deviceId:   '',
  secretKey:  '',
  deviceDbId: '',
  ssid:       '',
  wifiPass:   '',
}


export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingState>(INITIAL_STATE)

  const patch = (partial: Partial<OnboardingState>) =>
    setData(prev => ({ ...prev, ...partial }))

  // useCallback tránh Step5 re-subscribe socket mỗi khi OnboardingPage re-render
  const next = useCallback(() => setStep(s => s + 1), [])
  const back = () => setStep(s => s - 1)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Onboarding thiết bị mới</h1>
        <p className="mt-0.5 text-sm text-warmGray">Hướng dẫn từng bước kết nối ESP32 vào hệ thống SwiftletCare</p>
      </div>

      {/* Stepper */}
      <Card className="!p-5">
        <Stepper steps={STEP_LABELS} current={step} />
      </Card>

      {/* Step content */}
      <Card className="!p-6">
        <div key={step} className="animate-step-in motion-reduce:animate-none">
          {step === 0 && <Step1Location data={data} patch={patch} onNext={next} />}
          {step === 1 && <Step2Validate data={data} patch={patch} onNext={next} onBack={back} />}
          {step === 2 && <Step3ConnectAP data={data} onNext={next} onBack={back} />}
          {step === 3 && <Step4WiFi data={data} onNext={next} onBack={back} />}
          {step === 4 && (
            <Step5WaitOnline
              data={data}
              onSuccess={() => navigate('/devices')}
              onRetry={() => setStep(2)} // Retry từ bước 3 (index 2)
            />
          )}
        </div>
      </Card>
    </div>
  )
}
