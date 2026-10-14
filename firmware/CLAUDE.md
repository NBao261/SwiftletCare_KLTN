# firmware/CLAUDE.md

Rules and architecture for `firmware/` (ESP32, PlatformIO + Arduino framework, FreeRTOS). This file wins over the root `CLAUDE.md` for firmware code; `/review-pr` judges firmware changes by it together with `firmware/README.md`. Rule tags: **[Bắt buộc]** = blocking, **[Nên]** = advisory.

Firmware **1.3.0** (`FIRMWARE_VERSION` in `src/config/Config.h`) follows the SRS v2.0.0 scope: the fan depends on temperature + humidity only, no heating relay, PUMP_DRY stops misting, safe state on sensor loss, `NOISE_ANOMALY` instead of `BIRD_PANIC`, detection parameters tunable over MQTT. It is **built and host-tested only — not yet flashed and exercised on a real board** (see the README for the on-device checks still owed).

## Commands (PlatformIO, not npm)

```bash
pio run -e esp32dev                    # build only, no board needed
pio run -e esp32dev --target upload    # flash over USB (only when firmware code changes)
pio device monitor -b 115200           # serial log
pio test -e native                     # host-side unit tests: test_fuzzy, test_filter, test_noise_anomaly, test_pump_dry
pio run -e modbus_scan                 # standalone RS485 slave-ID/baudrate scanner (test_noise_rs485.cpp only)
```

`pio test -e native` builds only the Arduino-free units (`pid/FuzzyControl`, `pid/PumpDryMonitor`, `sensors/SignalFilter`, `sensors/NoiseAnomalyDetector`) and needs g++ on PATH (Windows: MinGW, e.g. winget WinLibs). CI (`.github/workflows/ci.yml`, job Firmware) runs it on every PR that touches `firmware/`. `platformio.ini` envs: `esp32dev` (default, full firmware), `modbus_scan`, `native`.

Changing WiFi/broker network does **not** need reflashing: the device re-discovers the broker via mDNS (`resolveBrokerViaMdns()` in `mqtt/MQTTManager.cpp`), then falls back to captive-portal entry (`wifi/WiFiProvisioner.h`), then to the compiled `Secrets.h` default.

## Architecture: FreeRTOS, 3 tasks

```
sensors/  SensorManager — 5 RS485 Modbus sensors (RX GPIO16 / TX GPIO17, 4800bps, slave IDs 1-5: noise/CO2/NH3/light/temp+humidity)
          SignalFilter (median-5 + Kalman, temperature + humidity only) · NoiseAnomalyDetector (NOISE_ANOMALY by dB vs a per-hour-of-day
          learned p90 baseline, so daily bird exit/return noise is normal; skipped while the speaker plays) — both at 1 Hz in sensorTask
pid/      PIDController — 3 relays (misting/speaker/ventilation; IN4 is a spare, heating removed) + threat flags;
          misting + ventilation use FuzzyControl (Sugeno fuzzy → % duty, time-proportioned over a tunable window, default 120 s);
          PumpDryMonitor (PUMP_DRY → stop misting until the spray session ends)
audio/    AudioManager — DFPlayer Mini lullaby playback on schedule
mqtt/     publish telemetry/heartbeat/relay-status, subscribe to command topics
storage/  NVS (config) + SPIFFS (offline buffering)
wifi/     WiFiProvisioner — captive portal
main.cpp  SensorTask / PIDTask / MQTTTask
```

`config/Config.h`/`.cpp` hold the defaults — thresholds (temp 26–31 °C, humidity 75–95 %, light max 0.2; NH3/CO2 limits are not in the firmware), the five detection parameters and the lullaby schedule (05–07h / 17–19h). All are runtime-overridable via MQTT `config/update` and persisted to NVS, so editing a default only affects first boot.

**Fuzzy control.** Fan = f(temperature, humidity) only; NH3/CO2 are telemetry and backend alerts, never a control input. The controller reads **filtered** values (toggle `fuzzy_input_filter`); telemetry and anomaly detection use **raw** values. Only valid samples enter the filter — a NaN or out-of-range reading is skipped so it cannot poison the median/Kalman window. Membership breakpoints are offsets around the runtime `Config` thresholds, so `config/update` retunes it. Four coefficients (`fuzzy_humidity_band`, `fuzzy_temp_band`, `fuzzy_fan_dry_level`, `fuzzy_window_sec` — ENV-FR-021) are tunable per Zone from the backend (`zones.fuzzy_tuning`, `PUT /farms/zones/:zoneId/fuzzy-tuning`), clamped and stored in NVS. Telemetry carries `control_output {misting, ventilation}` (0–100 %), which the backend stores and analyses. `pid/FuzzyControl.cpp` is plain C++ (no Arduino) and is mirrored by `backend/src/utils/fuzzyModel.util.ts`.

**Safe state (THREAT-FR-013).** The loop uses the last valid temperature/humidity reading for at most `CONTROL_INPUT_MAX_AGE_CYCLES` (2) control periods; with no valid reading in that window (or one out of physical range) both demands are 0 and the relays switch off, while the loop keeps running so overrides still expire and sensor-fault alerts are still raised.

**PUMP_DRY (THREAT-FR-011).** Evaluated only while humidity is below `humidity_min`. After the pump has been on for `pump_dry_on_sec` (cumulative within one spray session, since the pump cycles) without humidity rising `pump_dry_min_rise_pct`, misting stops; the alert flag follows the latch and is re-sent until MQTT accepts it. The latch clears when demand reaches zero, on a manual override, or after `PUMP_DRY_RETRY_MS` (30 min, hand-picked) so a false positive cannot switch misting off for good. A failed sensor read keeps the monitor state.

**Detection parameters (EXPERT-FR-008).** `noise_margin_db`, `noise_min_sec`, `pump_dry_on_sec`, `pump_dry_min_rise_pct`, `speaker_drop_pct` arrive over `config/update`, are clamped and stored in NVS like the fuzzy coefficients.

**MQTT.** Topics `swiftletcare/{farmId}/{houseId}/{zoneId}/...` use real MongoDB ObjectIds. Command topics are per **zone** but a zone can hold several ESP32s, so `mqttCallback` drops a command whose `deviceId` names another device and applies one without `deviceId` (zone-wide thresholds). Firmware older than this filter applies everything. Remote `RESTART`/`OTA` commands in `config/update` are **not handled yet** (the backend returns 501 unless `FIRMWARE_COMMAND_SUPPORT=true`); OTA today is ElegantOTA at `http://<device-ip>/update` on the local network.

## Rules

- **[Bắt buộc]** `pid/FuzzyControl.cpp` and `backend/src/utils/fuzzyModel.util.ts` change together in the same PR, with the shared test cases (`test/test_fuzzy` and the backend tests that reuse them) updated.
- **[Bắt buộc]** Every runtime parameter arriving over `config/update` is range-checked and clamped on the device, persisted to NVS, and uses the same key name and range as the backend validator; out-of-range values never reach the controller.
- **[Bắt buộc]** Commands handled per device honour the `deviceId` filter; a new per-device command type follows the same rule.
- **[Bắt buộc]** The safe state holds: any change to sensor reading, filtering or the control loop keeps "no valid temp/humidity → misting and ventilation off, loop keeps running", and keeps alert/override handling alive.
- **[Bắt buộc]** NH3/CO2 never feed the fan or any relay (SRS §0.2 #7); no heating relay comes back; nothing new for removed features (predator detection, Zalo/SMS).
- **[Bắt buộc]** No threshold or timing without a source; a hand-picked engineering constant (like `PUMP_DRY_RETRY_MS`) is added to the unconfirmed-assumptions list at the end of SRS §0.5 in the same PR.
- **[Bắt buộc]** Logic that can live without Arduino (control, filtering, detection, monitors) stays in plain C++ units and gets `pio test -e native` tests; a behaviour change updates or adds a test that fails without it.
- **[Bắt buộc]** Telemetry, heartbeat and alert payload fields stay compatible with the backend handlers (`backend/src/mqtt/handlers/*.handler.ts`) and `docs/api/api-spec.yaml`; a field rename or new alert type is made on both sides in the same PR.
- **[Bắt buộc]** No secrets in the repo: credentials go in `src/config/Secrets.h` (git-ignored; `Secrets.h.example` is the template).
- **[Bắt buộc]** Bump `FIRMWARE_VERSION` with a one-line note when behaviour visible to the backend or the house changes.
- **[Nên]** FreeRTOS tasks never block on the network; shared state between tasks is protected (mutex/queue) rather than read half-written.
- **[Nên]** Comments explain *why* (SRS FR code, physical reason), not what the code does.

## Before opening a PR

- **[Bắt buộc]** `pio run -e esp32dev` builds and `pio test -e native` passes.
- **[Bắt buộc]** Say in the PR whether the change was exercised on a real board; if not, list the on-device checks still owed.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (firmware scopes are usually `hardware`, `env`, `mqtt`, `threat`).
