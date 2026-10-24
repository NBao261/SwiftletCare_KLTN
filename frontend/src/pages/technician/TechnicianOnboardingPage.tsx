// OnboardingPage — F-TC-01 / Stitch A3 + B5 + B6 + B7 + B9 + C1
// Wizard 6 bước lắp đặt thiết bị ESP32 — shell + state only
// Logic từng bước được tách sang ./steps/
//
// ticketId: đọc từ URL query ?ticketId=<id> khi Technician bắt đầu Onboarding
// từ màn hình Ticket (INSTALLATION ticket). Nếu vào trực tiếp từ nav, ticketId = undefined.
import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui'
import Stepper from '@/components/ui/Stepper'
import { Step1Location }   from '@/components/features/technician/onboarding/Step1Location'
import { Step2Validate }   from '@/components/features/technician/onboarding/Step2Validate'
import { Step3ConnectAP }  from '@/components/features/technician/onboarding/Step3ConnectAP'
import { Step4WiFi }       from '@/components/features/technician/onboarding/Step4WiFi'
import { Step5WaitOnline } from '@/components/features/technician/onboarding/Step5WaitOnline'
import { Step6SAT }        from '@/components/features/technician/onboarding/Step6SAT'
import type { OnboardingState } from '@/components/features/technician/onboarding/onboardingTypes'

// ── Wizard Stepper ─────────────────────────────────────────────────────────────
const STEP_LABELS = ['Vị trí', 'Thiết bị', 'Kết nối AP', 'WiFi farm', 'Đợi MQTT', 'Nghiệm thu']

// ── Page ──────────────────────────────────────────────────────────────────────
const INITIAL_STATE: OnboardingState = {
  location:   {},
  deviceType: 'SENSOR_NODE',
  deviceId:   '',
  secretKey:  '',
  deviceDbId: '',
  ticketId:   undefined,
  ssid:       '',
  wifiPass:   '',
}


export default function OnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  // Đọc ticketId từ URL query param ?ticketId=xxx (khi vào từ màn hình Ticket)
  const [data, setData] = useState<OnboardingState>({
    ...INITIAL_STATE,
    ticketId: searchParams.get('ticketId') ?? undefined,
  })

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
              onSuccess={next}
              onRetry={() => setStep(2)} // Retry từ bước 3 (index 2)
            />
          )}
          {step === 5 && (
            <Step6SAT
              data={data}
              onDone={() => navigate('/devices')}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
