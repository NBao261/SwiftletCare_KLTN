import { useState } from 'react';
import { DropIcon, SpeakerHighIcon, WarningIcon, WindIcon, type Icon } from '@phosphor-icons/react';

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

// 3 relay (phun sương, quạt, loa), nhãn dùng chung với khung Phân hệ điều khiển
const RELAYS: Array<{ key: Extract<RelayName, 'misting' | 'ventilation' | 'speaker'>; labelKey: 'relay.misting' | 'relay.ventilation' | 'relay.speaker'; icon: Icon }> = [
  { key: 'misting', labelKey: 'relay.misting', icon: DropIcon },
  { key: 'ventilation', labelKey: 'relay.ventilation', icon: WindIcon },
  { key: 'speaker', labelKey: 'relay.speaker', icon: SpeakerHighIcon },
];

type RelayLabelKey = 'relay.misting' | 'relay.ventilation' | 'relay.speaker';

// Lệnh bật bơm đang chờ Farm Owner xác nhận (409 CONFIRMATION_REQUIRED, ENV-FR-016)
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
  // Relay đang can thiệp tay (log chưa kết thúc) — hiện nút về tự động riêng từng relay
  overriddenRelays?: ReadonlySet<RelayName>;
}

// 1 Zone một hàng (FO-02): tên Zone · chế độ, 3 rơ-le với nút bật/tắt có thời hạn (ENV-FR-016..018); chỉ vẽ bộ điều khiển online
export default function ScadaNodeCard({ node, zoneLabel, controlOutput, durationMinutes, durationText, overriddenRelays }: ScadaNodeCardProps): JSX.Element {
  const { t, hourMinute, dateTime } = useTranslation(dashboardDict);
  const controlRelay = useControlRelay();
  const clearOverride = useClearRelayOverride();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [pendingRelay, setPendingRelay] = useState<RelayName | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const isManual = node.control_mode === 'MANUAL';

  // Thời hạn thật của nút: bật bơm tối đa 30 phút (BR-08), còn lại theo thời hạn đang chọn
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
    <div className="grid gap-4 rounded-2xl border border-warmGray/15 p-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      {/* Trái: Zone, bộ điều khiển, chế độ; đang điều khiển tay thì kèm giờ tự về và nút về tự động ngay (ENV-FR-017, 018) */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-h3 text-charcoal" title={zoneLabel}>{zoneLabel}</h3>
          <span className={cn('rounded-full px-2.5 py-0.5 text-small font-semibold', isManual ? 'bg-statusYellow/70 text-charcoal' : 'bg-warmGray/15 text-graphite')}>
            {isManual ? t('scada.modeManual') : t('scada.modeAuto')}
          </span>
        </div>
        <p className="flex items-center gap-2 text-small text-warmGray">
          {node.device_id}
          <SimulatedBadge simulated={node.simulated} />
        </p>
        {isManual && (
          <>
            <p className="flex items-start gap-1.5 text-small text-charcoal">
              <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden="true" />
              {t('scada.manualUntil', { time: node.override_expiry ? hourMinute(node.override_expiry) : NO_VALUE })}
            </p>
            <Button variant="secondary" size="sm" className="self-start" loading={clearOverride.isPending && pendingRelay === null} onClick={() => handleBackToAuto()}>
              {t('scada.backToAuto')}
            </Button>
          </>
        )}
      </div>

      {/* Phải: 3 rơ-le, mỗi ô: tên · trạng thái · nút bật/tắt theo thời hạn đang chọn */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {RELAYS.map(relay => {
          const RelayIcon = relay.icon;
          const isOn = node.relay_states[relay.key];
          const output = relay.key === 'misting' || relay.key === 'ventilation' ? controlOutput?.[relay.key] : undefined;
          const { minutes, label } = relayDuration(relay.key, !isOn);
          const isCapped = minutes < durationMinutes;
          return (
            <div key={relay.key} className="flex flex-col gap-2 rounded-xl bg-warmGray/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-body font-semibold text-charcoal">
                  <RelayIcon size={16} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(relay.labelKey)}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-px text-small font-semibold', isOn ? 'bg-accent-600 text-charcoal' : 'bg-warmGray/15 text-warmGray')}>
                  {isOn ? t('relay.on') : t('relay.off')}
                </span>
              </div>
              {output !== undefined && !isManual && <p className="text-small text-warmGray">{t('scada.output', { percent: output })}</p>}
              {isCapped && <p className="text-small text-warmGray">{t('scada.pumpCap', { n: minutes })}</p>}
              <Button
                variant="secondary"
                size="sm"
                className="mt-auto w-full"
                disabled={controlRelay.isPending && pendingRelay !== relay.key}
                loading={controlRelay.isPending && pendingRelay === relay.key}
                onClick={() => handleSetRelay(relay.key, relay.labelKey, !isOn)}
              >
                {isOn ? t('scada.turnOff', { duration: label }) : t('scada.turnOn', { duration: label })}
              </Button>
              {isManual && overriddenRelays?.has(relay.key) && (
                <button
                  type="button"
                  disabled={clearOverride.isPending}
                  onClick={() => handleBackToAuto({ key: relay.key, labelKey: relay.labelKey })}
                  className="self-start text-small font-semibold text-graphite underline underline-offset-4 hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11"
                >
                  {t('scada.relayToAuto')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ENV-FR-016 — xác nhận bật bơm khi Zone đang có cảnh báo cảm biến/phun sương; lịch sử ghi alert_confirmed */}
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
    </div>
  );
}
