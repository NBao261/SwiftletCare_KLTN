import { describe, expect, it } from 'vitest';

import { buildDeviceInventory, queryInventory, tallyDevices, uptimeParts } from '@/components/features/farm-owner/devices/deviceInventory';
import type { CameraNode, DeviceStatus, House, SensorNode, Zone } from '@/types';

const limits = { temp_min: 26, temp_max: 31, humidity_min: 75, humidity_max: 95, light_max: 0.2, nh3_max: 25, co2_max: 1500 };

function house(id: string): House {
  return { _id: id, farm_id: 'farm', name: `Nhà ${id}`, floors: 1 };
}

function zone(id: string, houseId: string): Zone {
  return { _id: id, house_id: houseId, name: `Zone ${id}`, floor: 1, thresholds: limits };
}

function sensor(id: string, zoneId: string, status: DeviceStatus, extra: Partial<SensorNode> = {}): SensorNode {
  return {
    _id: id, device_id: id, zone_id: zoneId, firmware_version: '1.4.0', status, control_mode: 'AUTO',
    relay_states: { misting: false, speaker: false, ventilation: false },
    speaker_schedule: { enabled: false, windows: [] }, audio: { current_track: 1, volume: 20, playing: false, loop: false },
    registered_at: '2026-10-01T00:00:00Z', ...extra,
  };
}

function camera(id: string, status: DeviceStatus, extra: Partial<CameraNode> = {}): CameraNode {
  return { _id: id, device_id: id, zone_id: '', status, registered_at: '2026-10-01T00:00:00Z', ...extra };
}

describe('buildDeviceInventory', () => {
  const houses = [house('h1'), house('h2')];
  const zones = [zone('z1', 'h1'), zone('z2', 'h1'), zone('z3', 'h2')];
  const sensors = [
    sensor('s1', 'z1', 'ONLINE'),
    sensor('s2', 'z1', 'OFFLINE'),
    sensor('s3', 'z2', 'PENDING'),
    sensor('s4', 'z3', 'ONLINE'),
    sensor('gone', 'z1', 'ONLINE', { decommissioned_at: '2026-10-10T00:00:00Z' }),
  ];
  const cameras = [camera('c1', 'OFFLINE', { house_id: 'h1' }), camera('c2', 'ONLINE', { zone_id: 'z3' })];

  it('groups sensors by zone and cameras by house, skipping decommissioned devices', () => {
    const [first, second] = buildDeviceInventory({ houses, zones, sensors, cameras });
    expect(first.zoneGroups.map(group => [group.zone._id, group.devices.map(device => device.id)])).toEqual([
      ['z1', ['s1', 's2']],
      ['z2', ['s3']],
    ]);
    expect(first.cameras.map(device => device.id)).toEqual(['c1']);
    expect(first.tally).toEqual({ total: 4, online: 1, faulty: 2, pending: 1 });
    // Camera cũ chỉ có zone_id được quy ra nhà chứa Zone đó
    expect(second.cameras.map(device => device.id)).toEqual(['c2']);
    expect(second.tally).toEqual({ total: 2, online: 2, faulty: 0, pending: 0 });
  });

  it('keeps only one zone and drops house cameras when a zone is selected', () => {
    const [first, second] = buildDeviceInventory({ houses, zones, sensors, cameras, zoneId: 'z2' });
    expect(first.zoneGroups.map(group => group.zone._id)).toEqual(['z2']);
    expect(first.cameras).toEqual([]);
    expect(first.tally.total).toBe(1);
    expect(second.zoneGroups).toEqual([]);
  });

  it('lists older zones first (ObjectId order), newer zones last', () => {
    const [first] = buildDeviceInventory({ houses: [house('h1')], zones: [zone('z2', 'h1'), zone('z1', 'h1')], sensors: [], cameras: [] });
    expect(first.zoneGroups.map(group => group.zone._id)).toEqual(['z1', 'z2']);
  });

  it('keeps a house without zones with an empty tally', () => {
    const [empty] = buildDeviceInventory({ houses: [house('h9')], zones, sensors, cameras });
    expect(empty.zoneGroups).toEqual([]);
    expect(empty.tally).toEqual({ total: 0, online: 0, faulty: 0, pending: 0 });
  });
});

describe('tallyDevices', () => {
  it('counts OFFLINE devices as faulty', () => {
    const [inventory] = buildDeviceInventory({
      houses: [house('h1')],
      zones: [zone('z1', 'h1')],
      sensors: [sensor('a', 'z1', 'OFFLINE'), sensor('b', 'z1', 'OFFLINE')],
      cameras: [],
    });
    expect(tallyDevices(inventory.zoneGroups[0].devices)).toEqual({ total: 2, online: 0, faulty: 2, pending: 0 });
  });
});

describe('uptimeParts', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');

  it('splits the time since boot into days, hours and minutes', () => {
    expect(uptimeParts('2026-10-21T09:15:00Z', now)).toEqual({ days: 2, hours: 2, minutes: 45 });
  });

  it('returns undefined without a boot time or with a boot time in the future', () => {
    expect(uptimeParts(undefined, now)).toBeUndefined();
    expect(uptimeParts('2026-10-24T00:00:00Z', now)).toBeUndefined();
  });
});

describe('queryInventory', () => {
  const houses = [house('b'), house('a'), house('c')];
  const zones = [zone('za', 'a'), zone('zb', 'b')];
  const sensors = [sensor('node_a1', 'za', 'ONLINE'), sensor('node_b1', 'zb', 'OFFLINE'), sensor('node_b2', 'zb', 'ONLINE')];
  const inventory = buildDeviceInventory({ houses, zones, sensors, cameras: [] });
  const base = { keyword: '', health: '' as const, sortKey: 'name' as const, sortDirection: 'asc' as const };

  it('sorts by name, device count or faulty count', () => {
    expect(queryInventory(inventory, base).items.map(item => item.house._id)).toEqual(['a', 'b', 'c']);
    expect(queryInventory(inventory, { ...base, sortKey: 'devices', sortDirection: 'desc' }).items.map(item => item.house._id)).toEqual(['b', 'a', 'c']);
    expect(queryInventory(inventory, { ...base, sortKey: 'faulty', sortDirection: 'desc' }).items[0].house._id).toBe('b');
  });

  it('filters by health', () => {
    expect(queryInventory(inventory, { ...base, health: 'fault' }).items.map(item => item.house._id)).toEqual(['b']);
    expect(queryInventory(inventory, { ...base, health: 'empty' }).items.map(item => item.house._id)).toEqual(['c']);
  });

  it('finds a house by its name, a zone or a device id and marks inner matches to expand', () => {
    expect(queryInventory(inventory, { ...base, keyword: 'nhà a' }).items.map(item => item.house._id)).toEqual(['a']);
    const byDevice = queryInventory(inventory, { ...base, keyword: 'NODE_B2' });
    expect(byDevice.items.map(item => item.house._id)).toEqual(['b']);
    expect([...byDevice.matchedInside]).toEqual(['b']);
    expect(queryInventory(inventory, { ...base, keyword: 'zone za' }).items.map(item => item.house._id)).toEqual(['a']);
  });
});
