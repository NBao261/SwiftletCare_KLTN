# SwiftletCare API Documentation
**Version:** 1.0.0 | **Base URL:** `https://api.swiftletcare.vn`

## Authentication
All endpoints (except `/auth/*`) require `Authorization: Bearer <access_token>`

## Quick Reference
See `api-spec.yaml` for full OpenAPI 3.0 specification.

### Modules
- [Auth](./auth.md) – Registration, login, JWT, OTP
- [Farms](./farms.md) – Farm/House/Zone CRUD
- [Devices](./devices.md) – ESP32 and RPi node management
- [Telemetry](./telemetry.md) – Sensor data queries
- [Alerts](./alerts.md) – Alert management and acknowledgement
- [Analytics](./analytics.md) – Bird count trends, correlations
