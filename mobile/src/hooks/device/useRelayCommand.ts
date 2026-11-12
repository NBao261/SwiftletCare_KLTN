import { useEffect, useState } from 'react'
import { Alert as NativeAlert } from 'react-native'
import { CONFIRMATION_REQUIRED_CODE } from '@/constants/relayOverride'
import { useControlRelay } from '@/hooks/device/useControlRelay'
import type { RelayName, SensorNode } from '@/types'
import { parseConfirmationAlerts, type PumpBlockingAlert } from '@/utils/alert.utils'
import { readApiError } from '@/utils/apiError.utils'
import { buildPumpConfirmMessage, getRelayControlErrorMessage, getRelayMode } from '@/utils/relay.utils'
import { t } from '@/utils/i18n.utils'

// Thời gian chờ controller báo đã chuyển trạng thái = độ tươi của lệnh (BR-35, Report 3 §4.5: 60 s). Quá mốc này controller
// không còn áp dụng lệnh nên báo "chưa phản hồi" và cho gửi lại mà không sợ thành hai lệnh
const RELAY_ACK_TIMEOUT_MS = 60 * 1000

// Lệnh không tới được controller: backend chưa nối broker, hoặc controller không báo lại trong thời gian chờ
export type RelayDeliveryProblem = 'not-delivered' | 'timed-out'

interface RelayCommandOptions {
  // Backend trả 409 CONFIRMATION_REQUIRED (khu vực vừa có cảnh báo chặn bật bơm) — sheet tải lại danh sách cảnh báo chặn
  onConfirmationRequired?: () => void
}

// Gửi lệnh điều khiển tay một relay (ENV-FR-016) và theo dõi tới khi controller báo đúng trạng thái — dùng chung cho sheet điều
// khiển tay và nút gạt trên dòng relay. Bật bơm bị backend chặn (409) thì hỏi xác nhận bằng danh sách cảnh báo backend gửi kèm,
// đồng ý thì gửi lại kèm confirmed
export function useRelayCommand(controller: SensorNode | null, relay: RelayName | null, options: RelayCommandOptions = {}) {
  const controlRelay = useControlRelay()
  // Trạng thái đã gửi tới broker, đang chờ controller báo lại
  const [waitingState, setWaitingState] = useState<boolean | null>(null)
  // Lệnh gần nhất đã được controller áp dụng (relay chuyển MANUAL đúng trạng thái)
  const [hasApplied, setHasApplied] = useState(false)
  const [deliveryProblem, setDeliveryProblem] = useState<RelayDeliveryProblem | null>(null)

  const isWaitingApplied = Boolean(
    controller &&
      relay &&
      waitingState !== null &&
      getRelayMode(controller, relay) === 'MANUAL' &&
      controller.relay_states[relay] === waitingState,
  )
  // Controller đã báo đúng trạng thái: thôi chờ — đặt ngay trong lúc dựng, kể cả khi đã quá thời gian chờ
  if (isWaitingApplied) {
    setWaitingState(null)
    setHasApplied(true)
    setDeliveryProblem(null)
  }
  const isWaiting = waitingState !== null && deliveryProblem === null

  // Không chờ mãi: quá thời gian mà controller chưa báo thì cho gửi lại
  useEffect(() => {
    if (!isWaiting) return
    const timer = setTimeout(() => setDeliveryProblem('timed-out'), RELAY_ACK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isWaiting])

  const send = (state: boolean, durationMs: number, isAlertConfirmed = false) => {
    if (!controller || !relay) return
    setDeliveryProblem(null)
    setHasApplied(false)
    controlRelay.mutate(
      { sensorNodeId: controller._id, relay, state, durationMs, isAlertConfirmed },
      {
        onSuccess: ({ isCommandDelivered }) => {
          if (isCommandDelivered) setWaitingState(state)
          else setDeliveryProblem('not-delivered')
        },
        onError: error => {
          const errorInfo = readApiError(error)
          const isPumpOn = relay === 'misting' && state
          if (!isPumpOn || errorInfo.status !== 409 || errorInfo.code !== CONFIRMATION_REQUIRED_CODE) return
          options.onConfirmationRequired?.()
          const alerts = parseConfirmationAlerts(errorInfo.details)
          if (alerts.length > 0) confirmPumpOn(alerts, durationMs)
        },
      },
    )
  }

  // Hỏi lại trước khi bật bơm, liệt kê từng cảnh báo đang mở; đồng ý thì gửi kèm xác nhận
  const confirmPumpOn = (alerts: PumpBlockingAlert[], durationMs: number) =>
    NativeAlert.alert(t('Vẫn bật bơm?'), buildPumpConfirmMessage(alerts, durationMs), [
      { text: t('Huỷ'), style: 'cancel' },
      { text: t('Vẫn bật bơm'), style: 'destructive', onPress: () => send(true, durationMs, true) },
    ])

  const lastInput = controlRelay.variables
  // Câu lỗi theo mã của backend thay cho một câu chung
  const errorMessage =
    controlRelay.isError && lastInput
      ? getRelayControlErrorMessage(controlRelay.error, lastInput.relay === 'misting' && lastInput.state)
      : null
  // Trạng thái đang gửi hoặc đang chờ controller — nút gạt hiện trước trạng thái này; lệnh hỏng thì về trạng thái thật
  const sendingState = controlRelay.isPending && lastInput ? lastInput.state : null
  const pendingState = sendingState ?? (deliveryProblem ? null : waitingState)

  return {
    send,
    confirmPumpOn,
    isSending: controlRelay.isPending,
    isWaiting,
    hasApplied,
    pendingState,
    deliveryProblem,
    errorMessage,
  }
}
