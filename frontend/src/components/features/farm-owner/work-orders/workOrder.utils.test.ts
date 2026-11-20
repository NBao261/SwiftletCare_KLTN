// Test logic thuần của trang Work Order (G-21, OPS-FR-004, Report 3 §6.19)
import { describe, expect, it } from 'vitest';
import {
  WORK_ORDER_STATUSES, approvalDescriptionKey, isRecoveryUnverified, memberNames, ownerActions, reassignCandidates, statusFilterQuery,
} from '@/components/features/farm-owner/work-orders/workOrder.utils';
import type { Farm, House, WorkOrderStatus } from '@/types';

describe('isRecoveryUnverified — phiếu chờ duyệt mà hệ thống chưa kiểm được dữ liệu (BR-41)', () => {
  it('mở tay không gắn cảnh báo, ACTUATOR_FAULT, SPEAKER_FAILURE: chưa kiểm được', () => {
    expect(isRecoveryUnverified({ alert_id: null, alert_type: null })).toBe(true);
    expect(isRecoveryUnverified({ alert_id: 'a1', alert_type: 'ACTUATOR_FAULT' })).toBe(true);
    expect(isRecoveryUnverified({ alert_id: 'a1', alert_type: 'SPEAKER_FAILURE' })).toBe(true);
    expect(isRecoveryUnverified({ alert_id: 'a1', alert_type: 'UNEXPECTED_RESTART' })).toBe(true);
  });

  it('cảnh báo cảm biến: dữ liệu đã được kiểm', () => {
    expect(isRecoveryUnverified({ alert_id: 'a1', alert_type: 'SENSOR_FAULT' })).toBe(false);
    expect(isRecoveryUnverified({ alert_id: 'a1', alert_type: 'MISTING_INEFFECTIVE' })).toBe(false);
  });
});

describe('ownerActions — thao tác của Farm Owner theo trạng thái', () => {
  const repair = (status: WorkOrderStatus) => ownerActions({ status, kind: 'REPAIR' });
  const preventive = (status: WorkOrderStatus) => ownerActions({ status, kind: 'PREVENTIVE' });

  it('chờ duyệt: duyệt hoặc mở lại; chưa xong: tự làm, giao lại hoặc huỷ (OPS-FR-002, 004)', () => {
    expect(repair('AWAITING_APPROVAL')).toEqual(['approve', 'reopen']);
    expect(repair('OPEN')).toEqual(['start', 'reassign', 'cancel']);
    expect(repair('IN_PROGRESS')).toEqual(['done', 'reassign', 'cancel']);
  });

  it('đang kiểm dữ liệu: chỉ huỷ; đã đóng, đã huỷ: không có thao tác (backend trả 409)', () => {
    expect(repair('VERIFYING')).toEqual(['cancel']);
    expect(repair('CLOSED')).toEqual([]);
    expect(repair('CANCELLED')).toEqual([]);
  });

  it('chỉ duyệt được ở đúng 1 trạng thái', () => {
    expect(WORK_ORDER_STATUSES.filter(status => repair(status).includes('approve'))).toEqual(['AWAITING_APPROVAL']);
  });

  it('phòng ngừa: không bao giờ có huỷ (backend 409, SM-20), các thao tác khác giữ nguyên', () => {
    expect(WORK_ORDER_STATUSES.some(status => preventive(status).includes('cancel'))).toBe(false);
    expect(preventive('OPEN')).toEqual(['start', 'reassign']);
    expect(preventive('IN_PROGRESS')).toEqual(['done', 'reassign']);
    expect(preventive('AWAITING_APPROVAL')).toEqual(['approve', 'reopen']);
  });
});

describe('approvalDescriptionKey — câu trong hộp duyệt', () => {
  it('phòng ngừa: theo checklist, kể cả khi có cảnh báo đến hạn', () => {
    expect(approvalDescriptionKey({ kind: 'PREVENTIVE', alert_id: 'a1', alert_type: 'MAINTENANCE_DUE' })).toBe('approve.descPreventive');
  });

  it('sửa chữa: dữ liệu đã kiểm, hoặc chưa kiểm được', () => {
    expect(approvalDescriptionKey({ kind: 'REPAIR', alert_id: 'a1', alert_type: 'THRESHOLD_BREACH' })).toBe('approve.desc');
    expect(approvalDescriptionKey({ kind: 'REPAIR', alert_id: null, alert_type: null })).toBe('approve.descUnverified');
  });
});

describe('statusFilterQuery', () => {
  it('đang mở → open=true; tất cả → không lọc; 1 trạng thái → status', () => {
    expect(statusFilterQuery('open')).toEqual({ open: 'true' });
    expect(statusFilterQuery('all')).toEqual({});
    expect(statusFilterQuery('AWAITING_APPROVAL')).toEqual({ status: 'AWAITING_APPROVAL' });
  });
});

describe('reassignCandidates — thợ của nhà có thể nhận lại', () => {
  const farm = {
    members: [
      { user_id: 'tech-a', is_primary: false, joined_at: '', full_name: 'Thợ A', role: 'FARM_TECHNICIAN' },
      { user_id: 'tech-b', is_primary: false, joined_at: '', full_name: 'Thợ B', role: 'FARM_TECHNICIAN' },
    ],
  } as unknown as Farm;
  const house = {
    technicians: [{ user_id: 'tech-b', primary: false }, { user_id: 'tech-a', primary: true }, { user_id: 'left-farm', primary: false }],
  } as unknown as House;
  const names = memberNames([farm]);

  it('thợ chính đứng đầu; bỏ người đang nhận và người không còn trong farm', () => {
    expect(reassignCandidates(house, names, undefined)).toEqual([{ id: 'tech-a', name: 'Thợ A' }, { id: 'tech-b', name: 'Thợ B' }]);
    expect(reassignCandidates(house, names, 'tech-a')).toEqual([{ id: 'tech-b', name: 'Thợ B' }]);
  });

  it('nhà chưa có thợ thì danh sách rỗng', () => {
    expect(reassignCandidates(undefined, names, undefined)).toEqual([]);
  });
});
