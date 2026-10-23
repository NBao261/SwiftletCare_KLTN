import { useState } from 'react';
import { DropIcon, SpeakerHighIcon, WarningIcon, WindIcon, type Icon } from '@phosphor-icons/react';

import { Button } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { deviceStatusDict } from '@/constants/enumLabels.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useClearRelayOverride, useControlRelay } from '@/hooks/shared/useDevices';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
import type { ControlOutput, RelayName, SensorNode } from '@/types';
import { NO_VALUE } from '@/constants/display';

// 3 relay theo SRS v2 (sưởi đã bỏ), nhãn dùng chung với khung Phân hệ điều khiển
const RELAYS: Array<{ key: Extract<RelayName, 'misting' | 'ventilation' | 'speaker'>; labelKey: 'relay.misting' | 'relay.ventilation' | 'relay.speaker'; icon: Icon }> = [
  { key: 'misting', labelKey: 'relay.misting', icon: DropIcon },
  { key: 'ventilation', labelKey: 'relay.ventilation', icon: WindIcon },
  { key: 'speaker', labelKey: 'relay.speaker', icon: SpeakerHighIcon },
];

interface ScadaNodeCardProps {
  node: SensorNode;
  controlOutput?: ControlOutput;
  durationMinutes: number;
  durationText: string;
}

// 1 thiết bị: trạng thái, cảnh báo đang can thiệp tay, 3 relay với nút bật/tắt có thời hạn (ENV-FR-016..018)
export default function ScadaNodeCard({ node, controlOutput, durationMinutes, durationText }: ScadaNodeCardProps): JSX.Element {
  const { t, hourMinute } = useTranslation(dashboardDict);
  const { t: translateStatus } = useTranslation(deviceStatusDict);
  const controlRelay = useControlRelay();
  const clearOverride = useClearRelayOverride();
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [pendingRelay, setPendingRelay] = useState<RelayName | null>(null);
  const isOnline = node.status === 'ONLINE';
  const isManual = node.control_mode === 'MANUAL';

  function handleSetRelay(relay: RelayName, labelKey: 'relay.misting' | 'relay.ventilation' | 'relay.speaker', nextState: boolean): void {
    setPendingRelay(relay);
    controlRelay.mutate(
      { nodeId: node._id, relayName: relay, state: nextState, durationMs: durationMinutes * 60_000 },
      {
        onSuccess: () => push(t('scada.sent', {
          relay: t(labelKey),
          state: nextState ? t('scada.stateOn') : t('scada.stateOff'),
          duration: durationText,
        })),
        onError: error => push(apiErrorMessage(error, t('scada.sendFailed')), 'error'),
        onSettled: () => setPendingRelay(null),
      },
    );
  }

  function handleBackToAuto(): void {
    clearOverride.mutate(node._id, {
      onSuccess: () => push(t('scada.backToAutoDone', { device: node.device_id })),
      onError: error => push(apiErrorMessage(error, t('scada.backToAutoFailed')), 'error'),
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 p-4">
      {/* Tên thiết bị, trạng thái kết nối, chế độ chạy */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', isOnline ? 'bg-success' : 'bg-warmGray/50')} />
          <p className="truncate text-body font-semibold text-charcoal">{node.device_id}</p>
          <span className="text-small text-warmGray">{translateStatus(node.status)}</span>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            isManual ? 'bg-statusYellow/70 text-charcoal' : 'bg-warmGray/15 text-graphite',
          )}
        >
          {isManual ? t('scada.modeManual') : t('scada.modeAuto')}
        </span>
      </div>

      {/* Cảnh báo đang can thiệp tay (ENV-FR-017) và nút về tự động ngay (ENV-FR-018) */}
      {isManual && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 p-3">
          <p className="flex items-start gap-2 text-small text-charcoal">
            <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden="true" />
            {t('scada.manualBanner', { time: node.override_expiry ? hourMinute(node.override_expiry) : NO_VALUE })}
          </p>
          <Button variant="secondary" size="sm" className="self-start" loading={clearOverride.isPending} onClick={handleBackToAuto}>
            {t('scada.backToAuto')}
          </Button>
        </div>
      )}

      {!isOnline && <p className="text-small text-warmGray">{t('scada.offline')}</p>}

      {/* 3 relay với nút bật/tắt theo thời hạn đang chọn */}
      <div className="flex flex-col divide-y divide-warmGray/10">
        {RELAYS.map(relay => {
          const RelayIcon = relay.icon;
          const isOn = node.relay_states[relay.key];
          const output = relay.key === 'misting' || relay.key === 'ventilation' ? controlOutput?.[relay.key] : undefined;
          return (
            <div key={relay.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
                  <RelayIcon size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-small font-semibold text-charcoal">{t(relay.labelKey)}</p>
                  <p className="flex items-center gap-1.5 text-small text-warmGray">
                    <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', isOn ? 'bg-accent-600 text-charcoal' : 'bg-warmGray/15 text-warmGray')}>
                      {isOn ? t('relay.on') : t('relay.off')}
                    </span>
                    {output !== undefined && !isManual && t('scada.output', { percent: output })}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={!isOnline || (controlRelay.isPending && pendingRelay !== relay.key)}
                loading={controlRelay.isPending && pendingRelay === relay.key}
                onClick={() => handleSetRelay(relay.key, relay.labelKey, !isOn)}
              >
                {isOn ? t('scada.turnOff', { duration: durationText }) : t('scada.turnOn', { duration: durationText })}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
