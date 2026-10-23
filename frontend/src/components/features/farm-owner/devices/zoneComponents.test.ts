import { describe, expect, it } from 'vitest';

import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import {
  buildZoneComponents, latestReadingByNode, summarizeGroup, type DeviceCheck,
} from '@/components/features/farm-owner/devices/zoneComponents';
import type { Alert, DeviceStatus, SensorNode, TelemetryRecord } from '@/types';

const CHECKED_AT = Date.parse('2026-10-23T10:10:00Z');

function node(id: string, status: DeviceStatus): DeviceItem {
  return { id, deviceId: id, type: 'sensor', status, houseId: 'h1', zoneId: 'z1', registeredAt: '2026-10-01T00:00:00Z' };
}

function detail(id: string, status: DeviceStatus, extra: Partial<SensorNode> = {}): SensorNode {
  return {
    _id: id, device_id: id, zone_id: 'z1', firmware_version: '1.4.0', status, control_mode: 'AUTO',
    relay_states: { misting: false, speaker: false, ventilation: false, heating: false },
    speaker_schedule: { enabled: false, windows: [] }, audio: { current_track: 1, volume: 20, playing: false, loop: false },
    registered_at: '2026-10-01T00:00:00Z', ...extra,
  };
}

function reading(nodeId: string, timestamp: string, values: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return { node_id: nodeId, timestamp, is_anomaly: false, ...values };
}

function alert(nodeId: string, type: Alert['type'], status: Alert['status'] = 'ACTIVE'): Alert {
  return { _id: `${nodeId}-${type}`, farm_id: 'f', node_id: nodeId, type, severity: 'MEDIUM', title: '', message: '', status, created_at: '2026-10-23T00:00:00Z' };
}

function check(details: SensorNode[], records: TelemetryRecord[] = [], alerts: Alert[] = []): DeviceCheck {
  return {
    readings: latestReadingByNode(records),
    alerts,
    details: new Map(details.map(item => [item._id, item])),
    checkedAt: CHECKED_AT,
  };
}

function statusOf(groups: ReturnType<typeof buildZoneComponents>, kind: string, nodeId: string) {
  return groups.find(group => group.kind === kind)?.items.find(item => item.nodeId === nodeId);
}

describe('latestReadingByNode', () => {
  it('keeps the newest record of each node', () => {
    const latest = latestReadingByNode([
      reading('a', '2026-10-23T10:00:00Z', { temperature: 27 }),
      reading('a', '2026-10-23T10:05:00Z', { temperature: 28 }),
      reading('b', '2026-10-23T10:01:00Z', { temperature: 29 }),
    ]);
    expect(latest.get('a')?.temperature).toBe(28);
    expect(latest.get('b')?.temperature).toBe(29);
  });
});

describe('buildZoneComponents', () => {
  it('groups every component kind across the nodes of a zone', () => {
    const groups = buildZoneComponents([node('a', 'ONLINE'), node('b', 'ONLINE')]);
    expect(groups.map(group => group.kind)).toEqual(['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound', 'speaker', 'misting', 'ventilation']);
    expect(groups.every(group => group.items.length === 2)).toBe(true);
  });

  it('shows unchecked before the check, except for nodes known to be offline or waiting', () => {
    const groups = buildZoneComponents([node('a', 'ONLINE'), node('b', 'OFFLINE'), node('c', 'PENDING')]);
    expect(statusOf(groups, 'temperature', 'a')?.status).toBe('unchecked');
    expect(statusOf(groups, 'speaker', 'b')?.status).toBe('offline');
    expect(statusOf(groups, 'co2', 'c')?.status).toBe('pending');
  });

  it('marks a sensor ok, fault, stale or noData from the readings at check time', () => {
    const records = [
      reading('a', '2026-10-23T10:05:00Z', { temperature: 28.4 }),
      reading('b', '2026-10-23T08:00:00Z', { temperature: 30 }),
    ];
    const groups = buildZoneComponents(
      [node('a', 'ONLINE'), node('b', 'ONLINE'), node('c', 'ONLINE')],
      check([detail('a', 'ONLINE'), detail('b', 'ONLINE'), detail('c', 'ONLINE')], records),
    );
    expect(statusOf(groups, 'temperature', 'a')).toMatchObject({ status: 'ok', value: 28.4, readingAt: '2026-10-23T10:05:00Z' });
    expect(statusOf(groups, 'humidity', 'a')?.status).toBe('fault');
    expect(statusOf(groups, 'temperature', 'b')).toMatchObject({ status: 'stale', value: 30 });
    expect(statusOf(groups, 'temperature', 'c')?.status).toBe('noData');
  });

  it('uses the node status fetched at check time', () => {
    const groups = buildZoneComponents([node('a', 'ONLINE')], check([detail('a', 'OFFLINE')]));
    expect(statusOf(groups, 'speaker', 'a')?.status).toBe('offline');
    expect(groups.find(group => group.kind === 'speaker')?.faulty).toBe(1);
  });

  it('uses relay states, audio and open alerts for speakers, pumps and the RS485 bus', () => {
    const playing = detail('a', 'ONLINE', {
      relay_states: { misting: true, speaker: true, ventilation: false, heating: false },
      audio: { current_track: 2, volume: 18, playing: true, loop: true },
    });
    const records = [reading('b', '2026-10-23T10:00:00Z', { temperature: 27, sound_db: 40 })];
    const alerts = [alert('b', 'SPEAKER_FAILURE'), alert('b', 'RS485_BUS_FAILURE'), alert('a', 'PUMP_DRY', 'RESOLVED')];
    const groups = buildZoneComponents([node('a', 'ONLINE'), node('b', 'ONLINE')], check([playing, detail('b', 'ONLINE')], records, alerts));
    expect(statusOf(groups, 'speaker', 'a')).toMatchObject({ status: 'on', detail: playing });
    expect(statusOf(groups, 'misting', 'a')?.status).toBe('on');
    expect(statusOf(groups, 'ventilation', 'a')?.status).toBe('off');
    expect(statusOf(groups, 'speaker', 'b')?.status).toBe('fault');
    // Lỗi bus RS485 kéo cả 5 cảm biến RS485 về lỗi, micro âm thanh vẫn đọc
    expect(statusOf(groups, 'temperature', 'b')?.status).toBe('fault');
    expect(statusOf(groups, 'sound', 'b')).toMatchObject({ status: 'ok', value: 40 });
  });

  it('returns no group for a zone without sensor nodes', () => {
    expect(buildZoneComponents([])).toEqual([]);
  });
});

describe('summarizeGroup', () => {
  it('counts running, off, faulty (offline included), waiting and unchecked units', () => {
    const items = [
      { nodeId: 'a', deviceId: 'a', status: 'on' as const },
      { nodeId: 'b', deviceId: 'b', status: 'ok' as const, value: 28 },
      { nodeId: 'c', deviceId: 'c', status: 'off' as const },
      { nodeId: 'd', deviceId: 'd', status: 'fault' as const },
      { nodeId: 'e', deviceId: 'e', status: 'offline' as const },
      { nodeId: 'f', deviceId: 'f', status: 'noData' as const },
      { nodeId: 'g', deviceId: 'g', status: 'stale' as const },
      { nodeId: 'h', deviceId: 'h', status: 'unchecked' as const },
    ];
    expect(summarizeGroup(items)).toEqual({ running: 2, off: 1, faulty: 2, waiting: 2, unchecked: 1 });
  });
});
