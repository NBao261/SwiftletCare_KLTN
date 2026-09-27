import { Router } from 'express'
import { body, param } from 'express-validator'
import multer from 'multer'
import * as deviceController from '@/controllers/devices.controller'
import * as audioTrackController from '@/controllers/audioTracks.controller'
import { MAX_AUDIO_BYTES } from '@/services/audioTrack.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

// Giữ file trong RAM (≤10MB) rồi service đẩy thẳng lên MinIO — không ghi đĩa tạm
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } })
const trackParams = [param('id').isMongoId(), param('trackId').isMongoId()]

// Sensor Nodes (ESP32)
// Đăng ký/kích hoạt thiết bị là việc của Technician (nhân viên công ty) qua Web
// Console Onboarding — Farm Owner KHÔNG tự đăng ký (SRS §4.1, FARM-FR-003, RACI mục 4.4).
// Flow 1 bước 3–4 — phải kèm secretKey in trên nhãn thiết bị
router.post('/sensor-nodes/register',        requireRole('TECHNICIAN','ADMIN'), body('device_id').trim().notEmpty(), body('zone_id').isMongoId(), body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerSensorNode)
router.get ('/sensor-nodes',                 deviceController.listSensorNodes)
router.get ('/sensor-nodes/:id',             param('id').isMongoId(), validate, deviceController.getSensorNode)
// Chỉnh thông số vận hành vẫn thuộc Farm Owner (ENV-FR-006); Technician chỉnh khi xử lý sự cố.
router.put ('/sensor-nodes/:id/thresholds',  requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, deviceController.updateThresholds)
// Lịch loa ru (ENV-FR-013b) — firmware chỉ có 2 khung giờ, theo giờ tròn; tắt lịch dùng enabled=false.
router.put ('/sensor-nodes/:id/speaker-schedule', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(),
  body('enabled').optional().isBoolean(),
  body('windows').optional().isArray({ min: 1, max: 2 }).withMessage('windows phải có 1-2 khung giờ'),
  body('windows.*.start').matches(/^([01]\d|2[0-3]):00$/).withMessage('start phải là giờ tròn HH:00'),
  body('windows.*.end').matches(/^(([01]\d|2[0-3]):00|24:00)$/).withMessage('end phải là giờ tròn HH:00 (tối đa 24:00)'),
  body('volume').optional().isInt({ min: 0, max: 30 }).toInt(),
  body('track').optional().isInt({ min: 1 }).toInt(),
  validate, deviceController.updateSpeakerSchedule)
// Điều khiển relay: Farm Owner (vận hành hằng ngày) + Technician (khắc phục sự cố) — RACI mục 4.4.
router.post('/sensor-nodes/:id/relay',       requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), body('relayName').notEmpty(), body('state').isBoolean(), validate, deviceController.controlRelay)
router.delete('/sensor-nodes/:id/relay-override', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, deviceController.clearRelayOverride)

// File loa ru (ENV-FR-013c) — RACI SRS ⁹: upload/chép thẻ SD là việc phần cứng của
// Technician; chọn bài/nghe thử là vận hành của Farm Owner.
router.post  ('/sensor-nodes/:id/audio-tracks', requireRole('TECHNICIAN','ADMIN'), audioUpload.single('file'), param('id').isMongoId(),
  body('track_number').isInt({ min: 1, max: 255 }).withMessage('track_number phải là số nguyên 1-255 (0001.mp3 … 0255.mp3)').toInt(),
  body('display_name').trim().notEmpty().withMessage('Cần tên bài').isLength({ max: 100 }),
  validate, audioTrackController.uploadTrack)
router.get   ('/sensor-nodes/:id/audio-tracks', param('id').isMongoId(), validate, audioTrackController.listTracks)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/sync-status', requireRole('TECHNICIAN','ADMIN'), ...trackParams, body('synced_to_sd').isBoolean().toBoolean(), validate, audioTrackController.setSyncStatus)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/select', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.selectTrack)
router.post  ('/sensor-nodes/:id/audio-tracks/:trackId/play-now', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.playNow)
router.post  ('/sensor-nodes/:id/audio/stop', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, audioTrackController.stopPlayback)
router.delete('/sensor-nodes/:id/audio-tracks/:trackId', requireRole('TECHNICIAN','ADMIN'), ...trackParams, validate, audioTrackController.deleteTrack)

// Dời thiết bị sang Zone/Farm khác — chỉ khi ONLINE (FARM-FR-007b, Flow 21 Nhánh A).
// KHÔNG cho FARM_OWNER tự làm (SRS RACI mục 4.4 — gán nhầm Zone làm sai lệch telemetry vĩnh viễn).
router.put ('/sensor-nodes/:id/reassign-zone', requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('newZoneId').isMongoId(), validate, deviceController.reassignZone)

// Camera Nodes (RPi)
// FARM-FR-008 — gỡ/thay thiết bị, giữ nguyên lịch sử telemetry của thiết bị cũ
router.post('/sensor-nodes/:id/decommission', requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.decommission('sensor'))
router.post('/sensor-nodes/:id/replace',      requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(),
  body('new_device_id').trim().notEmpty(), body('secret_key').isString().trim().notEmpty(), body('reason').trim().notEmpty(),
  validate, deviceController.replaceSensorNode)
// TICKET-FR-008, Flow 15 — xử lý từ xa: khởi động lại / đẩy lại ngưỡng / OTA firmware
router.post('/sensor-nodes/:id/commands', requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(),
  body('command').isIn(['RESTART', 'PUSH_CONFIG', 'OTA']),
  body('ticket_id').optional().isMongoId(),
  // Không nhận tiền tố "v": heartbeat so sánh firmware_version bằng === với
  // FIRMWARE_VERSION của firmware ("1.0.0"), "v1.1.0" sẽ không bao giờ khớp
  // nên OTA thành công vẫn bị markOtaTimeouts báo thất bại sau 30 phút.
  body('ota.version').if(body('command').equals('OTA')).isString().trim().matches(/^\d+\.\d+\.\d+$/),
  body('ota.url').if(body('command').equals('OTA')).isURL({ protocols: ['https'], require_protocol: true, require_tld: false }),
  body('ota.sha256').if(body('command').equals('OTA')).isHash('sha256'),
  validate, deviceController.sendCommand)
router.post('/camera-nodes/:id/decommission', requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.decommission('camera'))
router.post('/camera-nodes/register',        requireRole('TECHNICIAN','ADMIN'), body('device_id').trim().notEmpty(), body('zone_id').isMongoId(), body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerCameraNode)
router.get ('/camera-nodes',                 deviceController.listCameraNodes)

// OPS-NFR-004 — Admin dashboard trạng thái node toàn hệ thống
router.get ('/system-status',                requireRole('ADMIN'), deviceController.getSystemStatus)

export default router
