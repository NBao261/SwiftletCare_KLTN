import { useState } from 'react';
import { DropIcon, HandIcon, SpeakerHighIcon, WindIcon, type Icon } from '@phosphor-icons/react';

import { pumpConfirmAlerts, relayMinutes, type PumpConfirmAlert } from '@/components/features/farm-owner/dashboard/scadaRelay';
import { Button, Modal } from '@/components/ui';
import SimulatedBadge from '@/components/common/SimulatedBadge';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useClearRelayOverride, useControlRelay } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
import type { ControlOutput, RelayName, SensorNode } from '@/types';
import { NO_VALUE } from '@/constants/display';

// 3 relay (phun sương, quạt, loa), nhãn dùng chung với khung Trạng thái điều khiển
const RELAYS: Array<{ key: Extract<RelayName, 'misting' | 'ventilation' | 'speaker'>; labelKey: 'relay.misting' | 'relay.ventilation' | 'relay.speaker'; icon: Icon }> = [
  { key: 'misting', labelKey: 'relay.misting', icon: DropIcon },
  { key: 'ventilation', labelKey: 'relay.ventilation', icon: WindIcon },
  { key: 'speaker', labelKey: 'relay.speaker', icon: SpeakerHighIcon },
];

type RelayLabelKey = 'relay.misting' | 'relay.ventilation' | 'relay.speaker';

// Lệnh bật bơm đang chờ Farm Owner xác nhận (409 CONFIRMATION_REQUIRED)
interface PendingConfirm {
  relay: RelayName;
  labelKey: RelayLabelKey;
  minutes: number;
  label: string;
  alerts: PumpConfirmAlert[];
}

interface ScadaNodeCardProps {
  node: SensorNode;
  // Tên Zone của bộ điều khiển (VD "A · Tầng 1")
  zoneLabel: string;
  controlOutput?: ControlOutput;
  durationMinutes: number;
  durationText: string;
  // Relay đang can thiệp tay (log chưa kết thúc): hiện nút về tự động riêng từng relay
  overriddenRelays?: ReadonlySet<RelayName>;
}

// 1 Zone một thẻ: tên Zone và chế độ ở đầu, 3 ô rơ-le (trạng thái, nguồn lệnh, nút Bật hoặc Tắt); chỉ vẽ bộ điều khiển online
export default function ScadaNodeCard({ node, zoneLabel, controlOutput, durationMinutes, durationText, overriddenRelays }: ScadaNodeCardProps): JSX.Element {
  const { t, hourMinute, dateTime } = useTranslation(dashboardDict);
  const controlRelay = useControlRelay();
  const clearOverride = useClearRelayOverride();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [pendingRelay, setPendingRelay] = useState<RelayName | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const isManual = node.control_mode === 'MANUAL';
  // Nút về tự động riêng từng rơ-le chỉ cần khi có nhiều hơn 1 rơ-le bị giữ tay; 1 rơ-le thì nút ở đầu thẻ đã đủ
  const canReleaseEach = (overriddenRelays?.size ?? 0) > 1;
  const manualUntil = node.override_expiry ? hourMinute(node.override_expiry) : NO_VALUE;

  // Thời hạn thật của nút: bật bơm tối đa 30 phút, còn lại theo thời hạn đang chọn
  function relayDuration(relay: RelayName, turnOn: boolean): { minutes: number; label: string } {
    const minutes = relayMinutes(relay, turnOn, durationMinutes);
    return { minutes, label: minutes === durationMinutes ? durationText : t('scada.minutes', { n: minutes }) };
  }

  function handleSetRelay(relay: RelayName, labelKey: RelayLabelKey, nextState: boolean, confirmed = false): void {
    const { minutes, label } = relayDuration(relay, nextState);
    setPendingRelay(relay);
    controlRelay.mutate(
      { nodeId: node._id, relayName: relay, state: nextState, durationMs: minutes * 60_000, confirmed },
      {
        onSuccess: () => {
          setConfirm(null);
          push(t('scada.sent', {
            relay: t(labelKey),
            state: nextState ? t('scada.stateOn') : t('scada.stateOff'),
            duration: label,
          }));
        },
        onError: error => {
          // Zone đang có cảnh báo cảm biến/phun sương: hỏi Farm Owner trước khi gửi lại với confirmed
          const alerts = pumpConfirmAlerts(error);
          if (alerts && !confirmed) {
            setConfirm({ relay, labelKey, minutes, label, alerts });
            return;
          }
          setConfirm(null);
          push(apiErrorMessage(error, t('scada.sendFailed')), 'error');
        },
        onSettled: () => setPendingRelay(null),
      },
    );
  }

  // Không truyền relay: cả thiết bị về tự động; có relay: chỉ relay đó (DELETE …/relay-override?relayName=)
  function handleBackToAuto(relay?: { key: RelayName; labelKey: RelayLabelKey }): void {
    setPendingRelay(relay?.key ?? null);
    clearOverride.mutate({ nodeId: node._id, relayName: relay?.key }, {
      onSuccess: () => push(relay
        ? t('scada.relayToAutoDone', { relay: t(relay.labelKey), device: node.device_id })
        : t('scada.backToAutoDone', { device: node.device_id })),
      onError: error => push(apiErrorMessage(error, t('scada.backToAutoFailed')), 'error'),
      onSettled: () => setPendingRelay(null),
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-warmGray/15 p-5" aria-label={zoneLabel}>
      {/* Đầu thẻ: Zone, bộ điều khiển; chế độ ở bên phải, đang điều khiển tay thì có nút về tự động cả thiết bị */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-charcoal" title={zoneLabel}>{zoneLabel}</h3>
          <p className="flex items-center gap-2 text-small text-warmGray">
            {node.device_id}
            <SimulatedBadge simulated={node.simulated} />
          </p>
        </div>
        {isManual ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-statusYellow/70 px-3 py-1 text-small font-semibold text-charcoal">
              <HandIcon size={14} weight="bold" aria-hidden />
              {t('scada.manualUntil', { time: manualUntil })}
            </span>
            <Button variant="secondary" size="sm" loading={clearOverride.isPending && pendingRelay === null} onClick={() => handleBackToAuto()}>
              {t('scada.backToAuto')}
            </Button>
          </div>
        ) : (
          <span className="rounded-full bg-warmGray/15 px-3 py-1 text-small font-semibold text-graphite">{t('scada.modeAuto')}</span>
        )}
      </div>

      {/* 3 ô rơ-le: biểu tượng, tên, BẬT/TẮT lớn, nguồn lệnh, nút */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RELAYS.map(relay => {
          const RelayIcon = relay.icon;
          const isOn = node.relay_states[relay.key];
          const output = relay.key === 'misting' || relay.key === 'ventilation' ? controlOutput?.[relay.key] : undefined;
          const { minutes } = relayDuration(relay.key, !isOn);
          const isCapped = !isOn && minutes < durationMinutes;
          const isHeld = isManual && overriddenRelays?.has(relay.key);
          return (
            <div key={relay.key} className={cn('flex flex-col gap-3 rounded-2xl border p-4 transition-colors', isOn ? 'border-accent-600/60 bg-accent-600/10' : 'border-warmGray/15 bg-white')}>
              <div className="flex items-center gap-3">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', isOn ? 'bg-accent-600 text-charcoal' : 'bg-warmGray/10 text-warmGray')}>
                  <RelayIcon size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-small font-semibold text-graphite">{t(relay.labelKey)}</p>
                  <p className={cn('text-2xl font-extrabold leading-none', isOn ? 'text-charcoal' : 'text-warmGray')}>{isOn ? t('relay.on') : t('relay.off')}</p>
                </div>
              </div>

              {/* Nguồn lệnh: tay (kèm giờ tự về) hoặc tự động (kèm công suất khi có) */}
              <p className="min-h-5 text-small text-warmGray">
                {isHeld
                  ? <span className="font-semibold text-charcoal">{t('scada.sourceManual')}</span>
                  : (output !== undefined && !isManual ? t('scada.autoOutput', { percent: output }) : t('scada.modeAuto'))}
              </p>

              <Button
                variant={isOn ? 'secondary' : 'primary'}
                size="sm"
                className="mt-auto w-full"
                disabled={controlRelay.isPending && pendingRelay !== relay.key}
                loading={controlRelay.isPending && pendingRelay === relay.key}
                onClick={() => handleSetRelay(relay.key, relay.labelKey, !isOn)}
              >
                {isOn ? t('scada.turnOffShort') : t('scada.turnOnShort')}
              </Button>
              {isCapped && <p className="-mt-1 text-small text-warmGray">{t('scada.pumpCapShort', { n: minutes })}</p>}
              {isHeld && canReleaseEach && (
                <button
                  type="button"
                  disabled={clearOverride.isPending}
                  onClick={() => handleBackToAuto({ key: relay.key, labelKey: relay.labelKey })}
                  className="-mt-1 self-start text-small font-semibold text-graphite underline underline-offset-4 hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11"
                >
                  {t('scada.relayToAuto')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* xác nhận bật bơm khi Zone đang có cảnh báo cảm biến/phun sương; lịch sử ghi alert_confirmed */}
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('scada.confirmTitle')}>
        {confirm && (
          <div className="flex flex-col gap-4">
            <hr className="border-gray-200" />
            <p className="text-body text-graphite">{t('scada.confirmDesc')}</p>
            <ul className="flex flex-col divide-y divide-orange-100 rounded-xl border-2 border-orange-300 bg-orange-50 px-3">
              {confirm.alerts.map(alert => (
                <li key={alert._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-charcoal">{alert.title}</span>
                  <span className="text-xs text-warmGray">{dateTime(alert.created_at)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirm(null)} disabled={controlRelay.isPending}>{t('scada.confirmCancel')}</Button>
              <Button
                variant="danger"
                loading={controlRelay.isPending}
                onClick={() => handleSetRelay(confirm.relay, confirm.labelKey, true, true)}
              >
                {t('scada.confirmOn')} · {confirm.label}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
