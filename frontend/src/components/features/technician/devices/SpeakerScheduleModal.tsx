import { useState, FormEvent } from 'react'
import { useUpdateSpeakerSchedule } from '@/hooks/shared/useDevices'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { Button, Input, Modal, Select, Toggle } from '@/components/ui'
import { MAX_SPEAKER_WINDOWS, hourLabel, validateSpeakerWindows } from '@/validations/common/speakerSchedule.validation'
import type { SensorNode, SpeakerWindow } from '@/types'

// Mặc định firmware (Config.h SPEAKER_WINDOW_*) — dùng khi thiết bị chưa từng được cấu hình lịch
const FIRMWARE_DEFAULT_WINDOWS: SpeakerWindow[] = [{ start: '05:00', end: '07:00' }, { start: '17:00', end: '19:00' }]
const START_HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h))     // 00:00 … 23:00
const END_HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h + 1))   // 01:00 … 24:00

/** ENV-FR-013b — lịch phát loa ru của 1 thiết bị (2 khung giờ tròn, âm lượng) */
export default function SpeakerScheduleModal({ node, onClose }: { node: SensorNode; onClose: () => void }) {
  const updateSchedule = useUpdateSpeakerSchedule(node._id)
  const push = useToastStore(s => s.push)
  const [enabled, setEnabled] = useState(node.speaker_schedule.enabled)
  const [windows, setWindows] = useState<SpeakerWindow[]>(
    node.speaker_schedule.windows.length > 0 ? node.speaker_schedule.windows.map(({ start, end }) => ({ start, end })) : FIRMWARE_DEFAULT_WINDOWS,
  )
  const [volume, setVolume] = useState(String(node.audio.volume))
  const [error, setError] = useState<string | null>(null)

  function setWindow(index: number, key: keyof SpeakerWindow, value: string) {
    setWindows(ws => ws.map((w, i) => (i === index ? { ...w, [key]: value } : w)))
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    const vol = Number(volume)
    const problem = validateSpeakerWindows(windows)
      ?? (Number.isInteger(vol) && vol >= 0 && vol <= 30 ? null : 'Âm lượng là số nguyên 0–30')
    setError(problem)
    if (problem) return
    updateSchedule.mutate({ enabled, windows, volume: vol }, {
      onSuccess: () => {
        push(node.status === 'ONLINE' ? 'Đã lưu lịch loa ru' : 'Đã lưu lịch loa ru — thiết bị sẽ nhận khi kết nối lại')
        onClose()
      },
      onError: err => push(getApiErrorMessage(err, 'Lưu lịch loa ru thất bại'), 'error'),
    })
  }

  return (
    <Modal open onClose={onClose} title={`Lịch loa ru — ${node.device_id}`}>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-charcoal">Phát theo lịch</span>
          <Toggle checked={enabled} onChange={setEnabled} aria-label="Phát theo lịch" />
        </div>

        {windows.map((w, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Select label={`Khung ${i + 1} — bắt đầu`} value={w.start} disabled={!enabled} onChange={e => setWindow(i, 'start', e.target.value)}>
                {START_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            <div className="flex-1">
              <Select label="Kết thúc" value={w.end} disabled={!enabled} onChange={e => setWindow(i, 'end', e.target.value)}>
                {END_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
            {windows.length > 1 && (
              <Button type="button" variant="secondary" size="sm" disabled={!enabled} onClick={() => setWindows(ws => ws.filter((_, j) => j !== i))}>
                Bỏ
              </Button>
            )}
          </div>
        ))}
        {windows.length < MAX_SPEAKER_WINDOWS && (
          <Button type="button" variant="secondary" size="sm" disabled={!enabled}
            onClick={() => setWindows(ws => [...ws, { start: '17:00', end: '19:00' }])}>
            + Thêm khung giờ
          </Button>
        )}

        <Input label="Âm lượng (0–30)" type="number" min={0} max={30} value={volume} onChange={e => setVolume(e.target.value)} />

        {error && <p className="text-xs text-alertRed">{error}</p>}
        <p className="text-xs text-warmGray">
          Thiết bị hỗ trợ tối đa 2 khung giờ, theo giờ tròn. Đổi âm lượng trong lúc loa đang phát sẽ áp dụng từ khung giờ kế tiếp.
          Bài phát chọn ở mục “File loa ru”.
        </p>
        <Button type="submit" loading={updateSchedule.isPending} className="w-full">Lưu lịch</Button>
      </form>
    </Modal>
  )
}
