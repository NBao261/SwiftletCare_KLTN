import { Router } from 'express'
import { body, param, query } from 'express-validator'
import multer from 'multer'
import * as deviceController from '@/controllers/devices.controller'
import { MAX_OVERRIDE_MS, MIN_OVERRIDE_MS, RELAY_NAMES } from '@/services/device.service'
import * as audioTrackController from '@/controllers/audioTracks.controller'
import * as streamController from '@/controllers/stream.controller'
import { MAX_AUDIO_BYTES } from '@/services/audioTrack.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { CAMERA_HOST_PATTERN, CAMERA_PATH_PATTERN } from '@/utils/cameraSource.util'

const router = Router()
router.use(authenticate)

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } })
const trackParams = [param('id').isMongoId(), param('trackId').isMongoId()]

router.post('/sensor-nodes/register',        requireRole('FARM_OWNER'), body('device_id').trim().notEmpty(), body('zone_id').isMongoId(), body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerSensorNode)
// Thiết bị gỡ trong 24 giờ còn khôi phục được
router.get ('/sensor-nodes',
  query('zoneId').optional().isString().isMongoId(), query('removed').optional().isString().isIn(['recent']), validate,
  deviceController.listSensorNodes)
router.get ('/sensor-nodes/:id',             param('id').isMongoId(), validate, deviceController.getSensorNode)
// Firmware chỉ có 2 khung giờ tròn
router.put ('/sensor-nodes/:id/speaker-schedule', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('enabled').optional().isBoolean(),
  body('windows').optional().isArray({ min: 1, max: 2 }).withMessage('windows phải có 1-2 khung giờ'),
  body('windows.*.start').matches(/^([01]\d|2[0-3]):00$/).withMessage('start phải là giờ tròn HH:00'),
  body('windows.*.end').matches(/^(([01]\d|2[0-3]):00|24:00)$/).withMessage('end phải là giờ tròn HH:00 (tối đa 24:00)'),
  body('volume').optional().isInt({ min: 0, max: 30 }).toInt(),
  body('track').optional().isInt({ min: 1 }).toInt(),
  validate, deviceController.updateSpeakerSchedule)
router.post('/sensor-nodes/:id/relay',       requireRole('FARM_OWNER','FARM_TECHNICIAN'), param('id').isMongoId(), body('relayName').notEmpty(), body('state').isBoolean(),
  // Giá trị cực lớn làm Zone bị tính 0% tự động mãi
  body('durationMs').optional().isInt({ min: MIN_OVERRIDE_MS, max: MAX_OVERRIDE_MS }).toInt(),
  // Giới hạn 30 phút của bơm kiểm ở service
  body('confirmed').optional().isBoolean().toBoolean(), validate, deviceController.controlRelay)
router.delete('/sensor-nodes/:id/relay-override', requireRole('FARM_OWNER','FARM_TECHNICIAN'), param('id').isMongoId(),
  query('relayName').optional().isString().isIn([...RELAY_NAMES]), validate, deviceController.clearRelayOverride)
router.get   ('/sensor-nodes/:id/relay-overrides', requireRole('FARM_OWNER','DOMAIN_EXPERT','FARM_TECHNICIAN'), param('id').isMongoId(), validate, deviceController.listRelayOverrides)

router.post  ('/sensor-nodes/:id/audio-tracks', requireRole('FARM_OWNER'), audioUpload.single('file'), param('id').isMongoId(),
  body('track_number').isInt({ min: 1, max: 255 }).withMessage('track_number phải là số nguyên 1-255 (0001.mp3 … 0255.mp3)').toInt(),
  body('display_name').trim().notEmpty().withMessage('Cần tên bài').isLength({ max: 100 }),
  validate, audioTrackController.uploadTrack)
router.get   ('/sensor-nodes/:id/audio-tracks', param('id').isMongoId(), validate, audioTrackController.listTracks)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/sync-status', requireRole('FARM_OWNER'), ...trackParams, body('synced_to_sd').isBoolean().toBoolean(), validate, audioTrackController.setSyncStatus)
router.put   ('/sensor-nodes/:id/audio-tracks/:trackId/select', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.selectTrack)
router.post  ('/sensor-nodes/:id/audio-tracks/:trackId/play-now', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.playNow)
router.post  ('/sensor-nodes/:id/audio/stop', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, audioTrackController.stopPlayback)
router.delete('/sensor-nodes/:id/audio-tracks/:trackId', requireRole('FARM_OWNER'), ...trackParams, validate, audioTrackController.deleteTrack)

router.put ('/sensor-nodes/:id/reassign-zone', requireRole('FARM_OWNER'), param('id').isMongoId(), body('newZoneId').isMongoId(), validate, deviceController.reassignZone)

router.post('/sensor-nodes/:id/decommission', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('reason').trim().notEmpty(),
  // toBoolean(): isBoolean() không đổi kiểu, "false" lọt xuống service là truthy
  body('force').optional().isBoolean().toBoolean(),
  validate, deviceController.decommission('sensor'))
router.post('/sensor-nodes/:id/restore', requireRole('FARM_OWNER'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.restore('sensor'))
router.post('/sensor-nodes/:id/replace',      requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('new_device_id').trim().notEmpty(), body('secret_key').isString().trim().notEmpty(), body('reason').trim().notEmpty(),
  validate, deviceController.replaceSensorNode)
// Farm Owner, Farm Technician chỉ RESTART (service kiểm)
router.post('/sensor-nodes/:id/commands', requireRole('ADMIN','FARM_OWNER','FARM_TECHNICIAN'), param('id').isMongoId(),
  body('command').isIn(['RESTART', 'PUSH_CONFIG', 'OTA']),
  // Không nhận tiền tố "v": heartbeat so firmware_version bằng ===
  body('ota.version').if(body('command').equals('OTA')).isString().trim().matches(/^\d+\.\d+\.\d+$/),
  body('ota.url').if(body('command').equals('OTA')).isURL({ protocols: ['https'], require_protocol: true, require_tld: false }),
  body('ota.sha256').if(body('command').equals('OTA')).isHash('sha256'),
  validate, deviceController.sendCommand)
router.post('/camera-nodes/:id/decommission', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('reason').trim().notEmpty(),
  // toBoolean(): như trên
  body('force').optional().isBoolean().toBoolean(),
  validate, deviceController.decommission('camera'))
router.post('/camera-nodes/:id/restore', requireRole('FARM_OWNER'), param('id').isMongoId(), body('reason').trim().notEmpty(), validate, deviceController.restore('camera'))
// zone_id cũ: quy ra House chứa Zone
router.post('/camera-nodes/register',        requireRole('FARM_OWNER'), body('device_id').trim().notEmpty(),
  body('house_id').if(body('zone_id').not().exists()).isString().isMongoId().withMessage('Cần house_id'),
  body('zone_id').optional().isString().isMongoId(),
  body('secret_key').isString().trim().notEmpty(), validate, deviceController.registerCameraNode)
router.get ('/camera-nodes',
  query('houseId').optional().isString().isMongoId(), query('zoneId').optional().isString().isMongoId(),
  query('removed').optional().isString().isIn(['recent']), validate,
  deviceController.listCameraNodes)
// 0–4 vòng, mỗi vòng đếm cả vào lẫn ra (rings: [] = dùng vòng mặc định); 3 đỉnh là vòng kín tối thiểu, 12 chống nhập nhầm.
// Không gửi rings thì là body cũ một vòng của app mobile
const ringFields = (prefix: string, field = (path: string) => body(path)) => [
  field(`${prefix}points`).isArray({ min: 3, max: 12 }).withMessage('points cần 3-12 đỉnh'),
  field(`${prefix}points.*`).isArray({ min: 2, max: 2 }).withMessage('mỗi đỉnh là [x, y]'),
  field(`${prefix}points.*.*`).isFloat({ min: 0, max: 1 }).withMessage('toạ độ theo tỷ lệ khung hình 0-1').toFloat(),
  field(`${prefix}into_ring_is_exit`).isBoolean({ strict: true }),
]
router.put ('/camera-nodes/:id/counting-ring', requireRole('FARM_OWNER','DOMAIN_EXPERT','FARM_TECHNICIAN'), param('id').isMongoId(),
  body('rings').optional().isArray({ max: 4 }).withMessage('tối đa 4 vòng đếm')
    // vòng trùng nhau thì một con chim bị đếm hai lần
    .custom((rings: Array<{ points?: unknown }>) => new Set(rings.map(ring => JSON.stringify(ring?.points))).size === rings.length)
    .withMessage('hai vòng đếm trùng nhau'),
  ...ringFields('rings.*.'),
  ...ringFields('', path => body(path).if(body('rings').not().exists())),
  validate, deviceController.updateCountingRing)
// Địa chỉ camera IP của nút AI: chỉ Farm Owner (thiết lập thiết bị), mật khẩu không bao giờ trả ra
router.get ('/camera-nodes/:id/source', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, deviceController.getCameraSource)
router.put ('/camera-nodes/:id/source', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('host').isString().trim().matches(CAMERA_HOST_PATTERN),
  body('port').isInt({ min: 1, max: 65535 }).toInt(),
  body('username').isString().trim().isLength({ max: 64 }),
  body('password').optional().isString().isLength({ max: 128 }),
  body('path').isString().trim().matches(CAMERA_PATH_PATTERN),
  validate, deviceController.updateCameraSource)
router.get ('/camera-nodes/:id/stream-token', requireRole('FARM_OWNER','DOMAIN_EXPERT','FARM_TECHNICIAN'), param('id').isMongoId(), validate, streamController.getStreamToken)

router.get ('/system-status',                requireRole('ADMIN'), deviceController.getSystemStatus)

export default router
