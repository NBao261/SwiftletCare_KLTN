// OnboardingPage — F-TC-01 / Stitch A3 + B5 + B6 + B7 + B9 + C1
// Wizard 6 bước lắp đặt thiết bị ESP32 — shell + state only
// Logic từng bước được tách sang ./steps/
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import { Step1Location }   from './steps/Step1Location'
import { Step2Validate }   from './steps/Step2Validate'
import { Step3ConnectAP }  from './steps/Step3ConnectAP'
import { Step4WiFi }       from './steps/Step4WiFi'
import { Step5WaitOnline } from './steps/Step5WaitOnline'
import { Step6SAT }        from './steps/Step6SAT'
import type { OnboardingState } from './steps/onboardingTypes'

// ── Wizard Stepper ─────────────────────────────────────────────────────────────
const STEP_LABELS = ['Vị trí', 'Thiết bị', 'Kết nối AP', 'WiFi farm', 'Đợi MQTT', 'Nghiệm thu']

function WizardStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEP_LABELS.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                done   ? 'bg-charcoal text-white' :
                active ? 'h-9 w-9 bg-limeMist text-charcoal ring-2 ring-charcoal' :
                         'bg-graphite/15 text-warmGray'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`hidden text-center text-[10px] font-semibold sm:block ${
                active ? 'text-charcoal' : 'text-warmGray'
              }`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < current ? 'bg-charcoal' : 'bg-graphite/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

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

  const next = () => setStep(s => s + 1)
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
        <WizardStepper current={step} />
      </Card>

      {/* Step content */}
      <Card className="!p-6">
        {step === 0 && <Step1Location data={data} patch={patch} onNext={next} />}
        {step === 1 && <Step2Validate data={data} patch={patch} onNext={next} onBack={back} />}
        {step === 2 && <Step3ConnectAP data={data} onNext={next} onBack={back} />}
        {step === 3 && <Step4WiFi data={data} patch={patch} onNext={next} onBack={back} />}
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
            onDone={(ticketId) => navigate(ticketId ? `/tickets/${ticketId}` : '/tickets')}
          />
        )}
      </Card>
    </div>
  )
}
