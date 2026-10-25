import { Router } from 'express'
import { body, param, query } from 'express-validator'
import multer from 'multer'
import * as deviceController from '@/controllers/devices.controller'
import { MAX_OVERRIDE_MS, MIN_OVERRIDE_MS } from '@/services/device.service'
import * as audioTrackController from '@/controllers/audioTracks.controller'
import * as streamController from '@/controllers/stream.controller'
import { MAX_AUDIO_BYTES } from '@/services/audioTrack.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

// Giữ file trong RAM (≤10MB) rồi service đẩy thẳng lên MinIO — không ghi đĩa tạm
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } })
const trackParams = [param('id').isMongoId(), param('trackId').isMongoId()]

// Sensor Nodes (ESP32)
// MF-10 — Farm Owner tự setup thiết bị ở farm của mình (service kiểm farm), Technician hỗ trợ;
// Admin không (FARM-FR-003, Report 3 §2.4). Phải kèm secretKey in trên nhãn thiết bị
router.post('/sensor-nodes/register',        requireRole('FARM_OWNER','TECHNICIAN'), body('device_id').trim().notEmpty(), body('zone_id').isMongoId(), body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerSensorNode)
router.get ('/sensor-nodes',                 deviceController.listSensorNodes)
router.get ('/sensor-nodes/:id',             param('id').isMongoId(), validate, deviceController.getSensorNode)
// Ngưỡng: Farm Owner và Domain Expert (ENV-FR-006); Technician, Admin không (Report 3 §2.4)
router.put ('/sensor-nodes/:id/thresholds',  requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('id').isMongoId(), validate, deviceController.updateThresholds)
// Lịch loa ru (ENV-FR-013b, BR-07) — chỉ Farm Owner; firmware chỉ có 2 khung giờ, theo giờ tròn;
// tắt lịch dùng enabled=false.
router.put ('/sensor-nodes/:id/speaker-schedule', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('enabled').optional().isBoolean(),
  body('windows').optional().isArray({ min: 1, max: 2 }).withMessage('windows phải có 1-2 khung giờ'),
  body('windows.*.start').matches(/^([01]\d|2[0-3]):00$/).withMessage('start phải là giờ tròn HH:00'),
  body('windows.*.end').matches(/^(([01]\d|2[0-3]):00|24:00)$/).withMessage('end phải là giờ tròn HH:00 (tối đa 24:00)'),
  body('volume').optional().isInt({ min: 0, max: 30 }).toInt(),
  body('track').optional().isInt({ min: 1 }).toInt(),
  validate, deviceController.updateSpeakerSchedule)
// Can thiệp tay relay chỉ Farm Owner (ENV-FR-016, Report 3 §2.4): Technician, Admin, Domain Expert không
router.post('/sensor-nodes/:id/relay',       requireRole('FARM_OWNER'), param('id').isMongoId(), body('relayName').notEmpty(), body('state').isBoolean(),
  // Không chặn thì 1 giá trị cực lớn tạo override hàng chục năm: Zone bị tính 0% tự động mãi (ANALYTICS-FR-011)
  body('durationMs').optional().isInt({ min: MIN_OVERRIDE_MS, max: MAX_OVERRIDE_MS }).toInt(), validate, deviceController.controlRelay)
router.delete('/sensor-nodes/:id/relay-override', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, deviceController.clearRelayOverride)
// ENV-FR-019 — lịch sử can thiệp tay: Farm Owner và Domain Expert (chỉ đọc)
router.get   ('/sensor-nodes/:id/relay-overrides', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('id').isMongoId(), validate, deviceController.listRelayOverrides)

// File loa ru (ENV-FR-013c) — upload/chép thẻ SD là việc phần cứng của Technician;
// chọn bài/nghe thử là vận hành của Farm Owner. Admin không (Report 3 §2.4).
router.post  ('/sensor-nodes/:id/audio-tracks', requireRole('TECHNICIAN'), audioUpload.single('file'), param('id').isMongoId(),
  body('track_number').isInt({ min: 1, max: 255 }).withMessage('track_number phải là số nguyên 1-255 (0001.mp3 … 0255.mp3)').toInt(),
  body('display_name').trim().notEmpty().withMessage('Cần tên bài').isLength({ max: 100 }),
  validate, audioTrackController.uploadTrack)
router.get   ('/sensor-nodes/:id/audio-tracks', param('id').isMongoId(), validate, audioTrackController.listTracks)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/sync-status', requireRole('TECHNICIAN'), ...trackParams, body('synced_to_sd').isBoolean().toBoolean(), validate, audioTrackController.setSyncStatus)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/select', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.selectTrack)
router.post  ('/sensor-nodes/:id/audio-tracks/:trackId/play-now', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.playNow)
router.post  ('/sensor-nodes/:id/audio/stop', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, audioTrackController.stopPlayback)
router.delete('/sensor-nodes/:id/audio-tracks/:trackId', requireRole('TECHNICIAN'), ...trackParams, validate, audioTrackController.deleteTrack)

// Dời thiết bị sang Zone khác — chỉ khi ONLINE (FARM-FR-007b). Farm Owner (cả Zone nguồn và đích
// phải thuộc farm của mình, service kiểm) và Technician (MF-10, Report 3 §2.4)
router.put ('/sensor-nodes/:id/reassign-zone', requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(), body('newZoneId').isMongoId(), validate, deviceController.reassignZone)

// Camera Nodes (RPi)
// FARM-FR-008 — gỡ/thay thiết bị, giữ nguyên lịch sử telemetry của thiết bị cũ
router.post('/sensor-nodes/:id/decommission', requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(),
  body('reason').trim().notEmpty(),
  // toBoolean(): isBoolean() chỉ kiểm tra, không đổi kiểu — chuỗi "false" lọt xuống service là truthy
  body('force').optional().isBoolean().toBoolean(),
  validate, deviceController.decommission('sensor'))
router.post('/sensor-nodes/:id/restore', requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.restore('sensor'))
router.post('/sensor-nodes/:id/replace',      requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(),
  body('new_device_id').trim().notEmpty(), body('secret_key').isString().trim().notEmpty(), body('reason').trim().notEmpty(),
  validate, deviceController.replaceSensorNode)
// FARM-FR-013 — xử lý từ xa (khởi động lại / đẩy lại ngưỡng / OTA firmware): chỉ Technician
router.post('/sensor-nodes/:id/commands', requireRole('TECHNICIAN'), param('id').isMongoId(),
  body('command').isIn(['RESTART', 'PUSH_CONFIG', 'OTA']),
  // Không nhận tiền tố "v": heartbeat so sánh firmware_version bằng === với
  // FIRMWARE_VERSION của firmware ("1.0.0"), "v1.1.0" sẽ không bao giờ khớp
  // nên OTA thành công vẫn bị markOtaTimeouts báo thất bại sau 30 phút.
  body('ota.version').if(body('command').equals('OTA')).isString().trim().matches(/^\d+\.\d+\.\d+$/),
  body('ota.url').if(body('command').equals('OTA')).isURL({ protocols: ['https'], require_protocol: true, require_tld: false }),
  body('ota.sha256').if(body('command').equals('OTA')).isHash('sha256'),
  validate, deviceController.sendCommand)
router.post('/camera-nodes/:id/decommission', requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(),
  body('reason').trim().notEmpty(),
  // toBoolean(): isBoolean() chỉ kiểm tra, không đổi kiểu — chuỗi "false" lọt xuống service là truthy
  body('force').optional().isBoolean().toBoolean(),
  validate, deviceController.decommission('camera'))
router.post('/camera-nodes/:id/restore', requireRole('FARM_OWNER','TECHNICIAN'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.restore('camera'))
// SRS v2.1.8 — camera đếm chim lắp ở cửa ra vào của cả nhà yến nên gắn House; zone_id là cách gửi cũ (quy ra House chứa Zone)
router.post('/camera-nodes/register',        requireRole('FARM_OWNER','TECHNICIAN'), body('device_id').trim().notEmpty(),
  body('house_id').if(body('zone_id').not().exists()).isString().isMongoId().withMessage('Cần house_id'),
  body('zone_id').optional().isString().isMongoId(),
  body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerCameraNode)
router.get ('/camera-nodes',
  query('houseId').optional().isString().isMongoId(), query('zoneId').optional().isString().isMongoId(), validate,
  deviceController.listCameraNodes)
// VISION-FR-018, SRS §4.4 — vòng đếm do Domain Expert vẽ; 3 đỉnh là tối thiểu của một vòng kín,
// 12 là giới hạn kỹ thuật chống nhập nhầm (SRS 0.5), toạ độ theo tỉ lệ khung hình
router.put ('/camera-nodes/:id/counting-ring', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(),
  body('points').isArray({ min: 3, max: 12 }).withMessage('points cần 3-12 đỉnh'),
  body('points.*').isArray({ min: 2, max: 2 }).withMessage('mỗi đỉnh là [x, y]'),
  body('points.*.*').isFloat({ min: 0, max: 1 }).withMessage('toạ độ theo tỉ lệ khung hình 0-1').toFloat(),
  body('into_ring_is_exit').isBoolean({ strict: true }),
  validate, deviceController.updateCountingRing)
// VISION-FR-013, SRS §4.4 — live stream chỉ cho Farm Owner và Domain Expert của farm chứa camera
router.get ('/camera-nodes/:id/stream-token', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('id').isMongoId(), validate, streamController.getStreamToken)

// OPS-NFR-004 — Admin dashboard trạng thái node toàn hệ thống
router.get ('/system-status',                requireRole('ADMIN'), deviceController.getSystemStatus)

export default router
