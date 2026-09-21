// OnboardingPage — F-TC-01 / Stitch A3 + B5 + B6 + B7 + B9 + C1
// Wizard 6 bước lắp đặt thiết bị ESP32 — shell + state only
// Logic từng bước được tách sang ./steps/
//
// ticketId: đọc từ URL query ?ticketId=<id> khi Technician bắt đầu Onboarding
// từ màn hình Ticket (INSTALLATION ticket). Nếu vào trực tiếp từ nav, ticketId = undefined.
import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui'
import DemoBanner from '@/components/common/DemoBanner'
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
    <div className="relative flex w-full items-start justify-between py-2 sm:px-2">
      {/* Background line */}
      <div 
        className="absolute top-6 h-0.5 -translate-y-1/2 rounded-full bg-graphite/15" 
        style={{ left: '8.33%', right: '8.33%' }}
      />
      
      {/* Active line */}
      <div 
        className="absolute top-6 h-0.5 -translate-y-1/2 rounded-full bg-charcoal transition-all duration-500 ease-in-out"
        style={{ left: '8.33%', width: `${(current / (STEP_LABELS.length - 1)) * 83.33}%` }}
      />

      {STEP_LABELS.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={label} className="relative z-10 flex w-1/6 flex-col items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
              done   ? 'bg-charcoal text-white shadow-sm ring-4 ring-white' :
              active ? 'bg-limeMist text-charcoal shadow-sm ring-4 ring-white' :
                       'bg-white text-warmGray ring-2 ring-graphite/15 ring-offset-2 ring-offset-white'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-center text-[10px] sm:text-[11px] font-semibold tracking-wide ${active ? 'text-charcoal' : 'text-warmGray'}`}>
              {label}
            </span>
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
      {/* Demo banner — Step4 WiFi config và một số bước chưa có backend endpoint */}
      <DemoBanner
        title="Một số bước chưa kết nối backend thật"
        description="Bước 4 (cấu hình WiFi) đang dùng endpoint demo. Các bước còn lại (đăng ký thiết bị, chờ MQTT, nghiệm thu) hoạt động với backend thật khi endpoint đã sẵn sàng."
      />

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
