import { describe, expect, it } from '@jest/globals'
import {
  clampTuningValue,
  countDirtyFields,
  getChangedFields,
  isWithinTuningRange,
  TUNING_RANGES,
} from '@/utils/tuning.utils'

describe('tuning.utils (BR-01, BR-02, BR-05, BR-09a-f, BR-28)', () => {
  describe('TUNING_RANGES definitions', () => {
    it('defines correct temperature and humidity ranges matching SRS BR-01, BR-02', () => {
      expect(TUNING_RANGES.temp_min.min).toBe(20.0)
      expect(TUNING_RANGES.temp_min.max).toBe(35.0)
      expect(TUNING_RANGES.temp_max.min).toBe(20.0)
      expect(TUNING_RANGES.temp_max.max).toBe(40.0)
      expect(TUNING_RANGES.humidity_min.min).toBe(50.0)
      expect(TUNING_RANGES.humidity_min.max).toBe(95.0)
      expect(TUNING_RANGES.humidity_max.min).toBe(60.0)
      expect(TUNING_RANGES.humidity_max.max).toBe(100.0)
    })

    it('defines correct gas and light ranges matching SRS BR-01', () => {
      expect(TUNING_RANGES.co2_max.min).toBe(500)
      expect(TUNING_RANGES.co2_max.max).toBe(5000)
      expect(TUNING_RANGES.nh3_max.min).toBe(5)
      expect(TUNING_RANGES.nh3_max.max).toBe(100)
      expect(TUNING_RANGES.light_max.min).toBe(0.0)
      expect(TUNING_RANGES.light_max.max).toBe(50.0)
    })

    it('defines correct fuzzy tuning ranges matching SRS BR-05', () => {
      expect(TUNING_RANGES.fuzzy_humidity_band.min).toBe(2.0)
      expect(TUNING_RANGES.fuzzy_humidity_band.max).toBe(20.0)
      expect(TUNING_RANGES.fuzzy_temp_band.min).toBe(1.0)
      expect(TUNING_RANGES.fuzzy_temp_band.max).toBe(10.0)
      expect(TUNING_RANGES.fuzzy_fan_dry_level.min).toBe(0)
      expect(TUNING_RANGES.fuzzy_fan_dry_level.max).toBe(100)
      expect(TUNING_RANGES.fuzzy_window_sec.min).toBe(60)
      expect(TUNING_RANGES.fuzzy_window_sec.max).toBe(600)
    })

    it('defines correct anomaly detection ranges matching SRS BR-09a-f', () => {
      expect(TUNING_RANGES.noise_margin_db.min).toBe(5)
      expect(TUNING_RANGES.noise_margin_db.max).toBe(30)
      expect(TUNING_RANGES.noise_min_sec.min).toBe(5)
      expect(TUNING_RANGES.noise_min_sec.max).toBe(15)
      expect(TUNING_RANGES.pump_dry_on_sec.min).toBe(120)
      expect(TUNING_RANGES.pump_dry_on_sec.max).toBe(900)
      expect(TUNING_RANGES.pump_dry_min_rise_pct.min).toBe(0.5)
      expect(TUNING_RANGES.pump_dry_min_rise_pct.max).toBe(10.0)
      expect(TUNING_RANGES.speaker_drop_pct.min).toBe(30)
      expect(TUNING_RANGES.speaker_drop_pct.max).toBe(90)
      expect(TUNING_RANGES.return_rate_drop_pct.min).toBe(5)
      expect(TUNING_RANGES.return_rate_drop_pct.max).toBe(50)
    })
  })

  describe('clampTuningValue', () => {
    it('clamps values below min to min', () => {
      expect(clampTuningValue('temp_min', 15)).toBe(20.0)
      expect(clampTuningValue('co2_max', 200)).toBe(500)
      expect(clampTuningValue('humidity_min', 30)).toBe(50.0)
    })

    it('clamps values above max to max', () => {
      expect(clampTuningValue('temp_min', 45)).toBe(35.0)
      expect(clampTuningValue('temp_max', 45)).toBe(40.0)
      expect(clampTuningValue('co2_max', 6000)).toBe(5000)
      expect(clampTuningValue('humidity_max', 110)).toBe(100.0)
    })

    it('preserves valid values inside range with proper decimal precision', () => {
      expect(clampTuningValue('temp_min', 27.5)).toBe(27.5)
      expect(clampTuningValue('co2_max', 1200)).toBe(1200)
      expect(clampTuningValue('pump_dry_min_rise_pct', 2.5)).toBe(2.5)
    })
  })

  describe('isWithinTuningRange', () => {
    it('returns true when value is within range', () => {
      expect(isWithinTuningRange('temp_min', 26)).toBe(true)
      expect(isWithinTuningRange('humidity_min', 75)).toBe(true)
      expect(isWithinTuningRange('fuzzy_fan_dry_level', 50)).toBe(true)
    })

    it('returns false when value is outside range', () => {
      expect(isWithinTuningRange('temp_min', 19.5)).toBe(false)
      expect(isWithinTuningRange('temp_min', 35.5)).toBe(false)
      expect(isWithinTuningRange('nh3_max', 2)).toBe(false)
      expect(isWithinTuningRange('nh3_max', 105)).toBe(false)
    })
  })

  describe('isDirty detection and countDirtyFields', () => {
    it('returns 0 when current matches initial', () => {
      const initial = { temp_min: 26, temp_max: 31, humidity_min: 75 }
      const current = { temp_min: 26, temp_max: 31, humidity_min: 75 }

      expect(countDirtyFields(current, initial)).toBe(0)
      expect(getChangedFields(current, initial)).toEqual({})
    })

    it('correctly counts modified fields and extracts diff', () => {
      const initial = { temp_min: 26, temp_max: 31, humidity_min: 75, humidity_max: 85 }
      const current = { temp_min: 27.5, temp_max: 31, humidity_min: 78, humidity_max: 85 }

      expect(countDirtyFields(current, initial)).toBe(2)
      expect(getChangedFields(current, initial)).toEqual({
        temp_min: 27.5,
        humidity_min: 78,
      })
    })
  })
})
