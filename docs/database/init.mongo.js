// SwiftletCare – MongoDB database script (collections, validators, indexes).
// GENERATED from backend/src/models by `npm run db:script` – do not edit by hand.
// Run: mongosh "<MONGODB_URI>" docs/database/init.mongo.js
// Safe to run twice: existing collections get their validator updated (collMod).

const existing = db.getCollectionNames()
function ensureCollection(name, schema) {
  const validator = { $jsonSchema: schema }
  if (existing.includes(name)) db.runCommand({ collMod: name, validator, validationLevel: 'moderate' })
  else db.createCollection(name, { validator, validationLevel: 'moderate' })
}

// ── alerts (model Alert) ──
ensureCollection("alerts", {
  "bsonType": "object",
  "properties": {
    "farm_id": {
      "bsonType": "objectId"
    },
    "zone_id": {
      "bsonType": ["objectId", "null"]
    },
    "house_id": {
      "bsonType": ["objectId", "null"]
    },
    "node_id": {
      "bsonType": ["objectId", "null"]
    },
    "type": {
      "bsonType": "string",
      "enum": ["THRESHOLD_BREACH", "NODE_OFFLINE", "SPEAKER_FAILURE", "MISTING_INEFFECTIVE", "NOISE_ANOMALY", "UNEXPECTED_RESTART", "LOW_RETURN_RATE", "EDGE_AI_DEGRADED", "SENSOR_FAULT", "RS485_BUS_FAILURE", "SENSOR_ANOMALY", "FORECAST_BREACH", "MAINTENANCE_DUE", "ACTUATOR_FAULT", "CONFIG_MISMATCH"]
    },
    "severity": {
      "bsonType": "string",
      "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    },
    "title": {
      "bsonType": "string"
    },
    "message": {
      "bsonType": "string"
    },
    "snapshot_url": {
      "bsonType": ["string", "null"]
    },
    "metadata": {},
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["ACTIVE", "ACKNOWLEDGED", "DISMISSED", "RESOLVED", null]
    },
    "previous_status": {
      "bsonType": ["string", "null"],
      "enum": ["ACTIVE", "ACKNOWLEDGED", null]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "last_seen_at": {
      "bsonType": ["date", "null"]
    },
    "occurrence_count": {
      "bsonType": ["number", "null"]
    },
    "acknowledged_at": {
      "bsonType": ["date", "null"]
    },
    "resolved_at": {
      "bsonType": ["date", "null"]
    },
    "acknowledged_by": {
      "bsonType": ["objectId", "null"]
    },
    "acknowledgement_note": {
      "bsonType": ["string", "null"]
    },
    "renotified_at": {
      "bsonType": ["date", "null"]
    },
    "expert_verdict": {
      "bsonType": ["object", "null"],
      "properties": {
        "result": {
          "bsonType": "string",
          "enum": ["CONFIRMED", "REJECTED"]
        },
        "note": {
          "bsonType": ["string", "null"]
        },
        "by": {
          "bsonType": "objectId"
        },
        "role": {
          "bsonType": ["string", "null"],
          "enum": ["DOMAIN_EXPERT", "FARM_OWNER", null]
        },
        "at": {
          "bsonType": "date"
        }
      },
      "required": ["result", "by", "at"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["farm_id", "type", "severity", "title", "message"]
})
db.getCollection("alerts").createIndex({"farm_id":1,"zone_id":1,"node_id":1,"type":1,"status":1})
db.getCollection("alerts").createIndex({"house_id":1,"type":1,"status":1}, {"partialFilterExpression":{"house_id":{"$exists":true}}})
db.getCollection("alerts").createIndex({"resolved_at":1}, {"expireAfterSeconds":15552000})

// ── audiotracks (model AudioTrack) ──
ensureCollection("audiotracks", {
  "bsonType": "object",
  "properties": {
    "node_id": {
      "bsonType": "objectId"
    },
    "track_number": {
      "bsonType": "number"
    },
    "display_name": {
      "bsonType": "string"
    },
    "file_key": {
      "bsonType": "string"
    },
    "file_size_bytes": {
      "bsonType": "number"
    },
    "synced_to_sd": {
      "bsonType": ["bool", "null"]
    },
    "uploaded_by": {
      "bsonType": "objectId"
    },
    "uploaded_at": {
      "bsonType": ["date", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["node_id", "track_number", "display_name", "file_key", "file_size_bytes", "uploaded_by"]
})
db.getCollection("audiotracks").createIndex({"node_id":1,"track_number":1}, {"unique":true})

// ── auditlogs (model AuditLog) ──
ensureCollection("auditlogs", {
  "bsonType": "object",
  "properties": {
    "actor_id": {
      "bsonType": ["objectId", "null"]
    },
    "actor_role": {
      "bsonType": ["string", "null"],
      "enum": ["ADMIN", "FARM_OWNER", "DOMAIN_EXPERT", "TECHNICIAN", null]
    },
    "farm_id": {
      "bsonType": ["objectId", "null"]
    },
    "action": {
      "bsonType": "string"
    },
    "target_type": {
      "bsonType": "string"
    },
    "target_id": {
      "bsonType": ["objectId", "null"]
    },
    "metadata": {},
    "ip_address": {
      "bsonType": ["string", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["action", "target_type"]
})
db.getCollection("auditlogs").createIndex({"target_type":1,"target_id":1})
db.getCollection("auditlogs").createIndex({"actor_id":1,"created_at":-1})
db.getCollection("auditlogs").createIndex({"created_at":-1})
db.getCollection("auditlogs").createIndex({"action":1,"created_at":-1})
db.getCollection("auditlogs").createIndex({"farm_id":1,"created_at":-1})

// ── birdcountbuckets (model BirdCountBucket) ──
ensureCollection("birdcountbuckets", {
  "bsonType": "object",
  "properties": {
    "camera_node_id": {
      "bsonType": "objectId"
    },
    "house_id": {
      "bsonType": "objectId"
    },
    "bucket_start": {
      "bsonType": "date"
    },
    "entry_count": {
      "bsonType": "number"
    },
    "exit_count": {
      "bsonType": "number"
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["camera_node_id", "house_id", "bucket_start", "entry_count", "exit_count"]
})
db.getCollection("birdcountbuckets").createIndex({"camera_node_id":1,"bucket_start":1}, {"unique":true})
db.getCollection("birdcountbuckets").createIndex({"house_id":1,"bucket_start":-1})
db.getCollection("birdcountbuckets").createIndex({"bucket_start":1}, {"expireAfterSeconds":7776000})

// ── birdcountrecords (model BirdCountRecord) ──
ensureCollection("birdcountrecords", {
  "bsonType": "object",
  "properties": {
    "camera_node_id": {
      "bsonType": "objectId"
    },
    "house_id": {
      "bsonType": "objectId"
    },
    "timestamp": {
      "bsonType": "date"
    },
    "session_date": {
      "bsonType": "string"
    },
    "session_type": {
      "bsonType": "string",
      "enum": ["MORNING_EXIT", "EVENING_ENTRY"]
    },
    "entry_count": {
      "bsonType": ["number", "null"]
    },
    "exit_count": {
      "bsonType": ["number", "null"]
    },
    "confidence_avg": {
      "bsonType": ["number", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["camera_node_id", "house_id", "timestamp", "session_date", "session_type"]
})
db.getCollection("birdcountrecords").createIndex({"house_id":1,"session_date":1})
db.getCollection("birdcountrecords").createIndex({"camera_node_id":1,"session_type":1,"session_date":1}, {"unique":true})

// ── cameranodes (model CameraNode) ──
ensureCollection("cameranodes", {
  "bsonType": "object",
  "properties": {
    "device_id": {
      "bsonType": "string"
    },
    "house_id": {
      "bsonType": "objectId"
    },
    "rtsp_url": {
      "bsonType": ["string", "null"]
    },
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["PENDING", "ONLINE", "OFFLINE", null]
    },
    "last_heartbeat": {
      "bsonType": ["date", "null"]
    },
    "model_version": {
      "bsonType": ["string", "null"]
    },
    "registered_at": {
      "bsonType": ["date", "null"]
    },
    "registered_by": {
      "bsonType": ["objectId", "null"]
    },
    "activation_overdue_at": {
      "bsonType": ["date", "null"]
    },
    "decommissioned_at": {
      "bsonType": ["date", "null"]
    },
    "decommission_reason": {
      "bsonType": ["string", "null"]
    },
    "replaced_by": {
      "bsonType": ["objectId", "null"]
    },
    "counting_ring": {
      "bsonType": ["object", "null"],
      "properties": {
        "points": {
          "bsonType": "array",
          "items": {
            "bsonType": "array",
            "items": {
              "bsonType": "number"
            }
          }
        },
        "into_ring_is_exit": {
          "bsonType": "bool"
        },
        "updated_at": {
          "bsonType": "date"
        },
        "updated_by": {
          "bsonType": "objectId"
        }
      },
      "required": ["points", "into_ring_is_exit", "updated_at", "updated_by"]
    },
    "counting_ring_history": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "changed_by": {
            "bsonType": ["objectId", "null"]
          },
          "changed_by_role": {
            "bsonType": ["string", "null"]
          },
          "changed_at": {
            "bsonType": ["date", "null"]
          },
          "old_value": {},
          "new_value": {},
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["device_id", "house_id"]
})
db.getCollection("cameranodes").createIndex({"device_id":1}, {"unique":true})
db.getCollection("cameranodes").createIndex({"status":1,"last_heartbeat":1})
db.getCollection("cameranodes").createIndex({"house_id":1})
db.getCollection("cameranodes").createIndex({"status":1,"registered_at":1})

// ── coefficientproposals (model CoefficientProposal) ──
ensureCollection("coefficientproposals", {
  "bsonType": "object",
  "properties": {
    "zone_id": {
      "bsonType": "objectId"
    },
    "farm_id": {
      "bsonType": "objectId"
    },
    "submitted_by": {
      "bsonType": "objectId"
    },
    "suggested_values": {},
    "current_values": {},
    "predicted": {},
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["PROPOSED", "APPROVED", "REJECTED", "SUPERSEDED", null]
    },
    "note": {
      "bsonType": ["string", "null"]
    },
    "decided_by": {
      "bsonType": ["objectId", "null"]
    },
    "decided_at": {
      "bsonType": ["date", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updated_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["zone_id", "farm_id", "submitted_by", "suggested_values", "current_values"]
})
db.getCollection("coefficientproposals").createIndex({"zone_id":1,"status":1})
db.getCollection("coefficientproposals").createIndex({"farm_id":1,"created_at":-1})

// ── farms (model Farm) ──
ensureCollection("farms", {
  "bsonType": "object",
  "properties": {
    "name": {
      "bsonType": "string"
    },
    "address": {
      "bsonType": "string"
    },
    "coordinates": {
      "bsonType": ["object", "null"],
      "properties": {
        "lat": {
          "bsonType": ["number", "null"]
        },
        "lng": {
          "bsonType": ["number", "null"]
        }
      }
    },
    "owner_id": {
      "bsonType": "objectId"
    },
    "members": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "user_id": {
            "bsonType": ["objectId", "null"]
          },
          "is_primary": {
            "bsonType": ["bool", "null"]
          },
          "role": {
            "bsonType": ["string", "null"],
            "enum": ["FARM_OWNER", "DOMAIN_EXPERT", null]
          },
          "joined_at": {
            "bsonType": ["date", "null"]
          },
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "is_deleted": {
      "bsonType": ["bool", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updatedAt": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["name", "address", "owner_id"]
})
db.getCollection("farms").createIndex({"owner_id":1})
db.getCollection("farms").createIndex({"members.user_id":1})

// ── harvestbatches (model HarvestBatch) ──
ensureCollection("harvestbatches", {
  "bsonType": "object",
  "properties": {
    "farm_id": {
      "bsonType": "objectId"
    },
    "zone_id": {
      "bsonType": "objectId"
    },
    "created_by": {
      "bsonType": "objectId"
    },
    "trace_code": {
      "bsonType": "string"
    },
    "harvest_date": {
      "bsonType": "date"
    },
    "nest_count": {
      "bsonType": "number"
    },
    "weight_grams": {
      "bsonType": "number"
    },
    "nest_type": {
      "bsonType": "string",
      "enum": ["RAW", "CLEANED", "PREMIUM"]
    },
    "product_images": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "string"
      }
    },
    "env_snapshot": {
      "bsonType": ["object", "null"],
      "properties": {
        "avg_temperature": {
          "bsonType": ["number", "null"]
        },
        "avg_humidity": {
          "bsonType": ["number", "null"]
        },
        "avg_light_lux": {
          "bsonType": ["number", "null"]
        },
        "avg_nh3_ppm": {
          "bsonType": ["number", "null"]
        },
        "avg_co2_ppm": {
          "bsonType": ["number", "null"]
        },
        "telemetry_range": {
          "bsonType": ["object", "null"],
          "properties": {
            "from": {
              "bsonType": ["date", "null"]
            },
            "to": {
              "bsonType": ["date", "null"]
            }
          }
        },
        "insufficient_data": {
          "bsonType": ["bool", "null"]
        }
      }
    },
    "flock_snapshot": {
      "bsonType": ["object", "null"],
      "properties": {
        "avg_return_rate_30d": {
          "bsonType": ["number", "null"]
        },
        "estimated_population": {
          "bsonType": ["number", "null"]
        }
      }
    },
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["DRAFT", null]
    },
    "is_deleted": {
      "bsonType": ["bool", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updated_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["farm_id", "zone_id", "created_by", "trace_code", "harvest_date", "nest_count", "weight_grams", "nest_type"]
})
db.getCollection("harvestbatches").createIndex({"trace_code":1}, {"unique":true})
db.getCollection("harvestbatches").createIndex({"farm_id":1,"harvest_date":-1})

// ── houses (model House) ──
ensureCollection("houses", {
  "bsonType": "object",
  "properties": {
    "farm_id": {
      "bsonType": "objectId"
    },
    "name": {
      "bsonType": "string"
    },
    "floors": {
      "bsonType": ["number", "null"]
    },
    "description": {
      "bsonType": ["string", "null"]
    },
    "bird_count_tuning": {
      "bsonType": ["object", "null"],
      "properties": {
        "return_rate_drop_pct": {
          "bsonType": ["number", "null"]
        }
      }
    },
    "bird_count_tuning_history": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "changed_by": {
            "bsonType": ["objectId", "null"]
          },
          "changed_by_role": {
            "bsonType": ["string", "null"]
          },
          "changed_at": {
            "bsonType": ["date", "null"]
          },
          "old_values": {},
          "new_values": {},
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updatedAt": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["farm_id", "name"]
})
db.getCollection("houses").createIndex({"farm_id":1})

// ── invitations (model Invitation) ──
ensureCollection("invitations", {
  "bsonType": "object",
  "properties": {
    "farm_id": {
      "bsonType": "objectId"
    },
    "invited_email": {
      "bsonType": "string"
    },
    "invited_role": {
      "bsonType": "string",
      "enum": ["FARM_OWNER", "DOMAIN_EXPERT"]
    },
    "invited_by": {
      "bsonType": "objectId"
    },
    "token": {
      "bsonType": "string"
    },
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", null]
    },
    "expires_at": {
      "bsonType": "date"
    },
    "responded_at": {
      "bsonType": ["date", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["farm_id", "invited_email", "invited_role", "invited_by", "token", "expires_at"]
})
db.getCollection("invitations").createIndex({"token":1}, {"unique":true})
db.getCollection("invitations").createIndex({"farm_id":1,"invited_email":1,"status":1})

// ── notifications (model Notification) ──
ensureCollection("notifications", {
  "bsonType": "object",
  "properties": {
    "user_id": {
      "bsonType": "objectId"
    },
    "title": {
      "bsonType": "string"
    },
    "body": {
      "bsonType": "string"
    },
    "ref": {
      "bsonType": ["object", "null"],
      "properties": {
        "kind": {
          "bsonType": "string",
          "enum": ["alert", "health_report", "expert_decision", "parameter_review", "coefficient_proposal"]
        },
        "id": {
          "bsonType": "objectId"
        }
      },
      "required": ["kind", "id"]
    },
    "read_at": {
      "bsonType": ["date", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["user_id", "title", "body"]
})
db.getCollection("notifications").createIndex({"user_id":1,"created_at":-1})
db.getCollection("notifications").createIndex({"created_at":1}, {"expireAfterSeconds":7776000})

// ── parameterreviews (model ParameterReview) ──
ensureCollection("parameterreviews", {
  "bsonType": "object",
  "properties": {
    "zone_id": {
      "bsonType": "objectId"
    },
    "farm_id": {
      "bsonType": "objectId"
    },
    "group": {
      "bsonType": "string",
      "enum": ["thresholds", "fuzzy"]
    },
    "old_values": {},
    "new_values": {},
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["PENDING_REVIEW", "ACCEPTED", "REVERTED", "ADJUSTED", null]
    },
    "changed_by": {
      "bsonType": "objectId"
    },
    "reviewed_by": {
      "bsonType": ["objectId", "null"]
    },
    "reviewed_at": {
      "bsonType": ["date", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updated_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["zone_id", "farm_id", "group", "old_values", "new_values", "changed_by"]
})
db.getCollection("parameterreviews").createIndex({"zone_id":1,"group":1,"status":1})
db.getCollection("parameterreviews").createIndex({"zone_id":1,"group":1}, {"unique":true,"partialFilterExpression":{"status":"PENDING_REVIEW"}})
db.getCollection("parameterreviews").createIndex({"farm_id":1,"created_at":-1})

// ── provisioneddevices (model ProvisionedDevice) ──
ensureCollection("provisioneddevices", {
  "bsonType": "object",
  "properties": {
    "device_id": {
      "bsonType": "string"
    },
    "kind": {
      "bsonType": "string",
      "enum": ["SENSOR", "CAMERA"]
    },
    "secret_key_hash": {
      "bsonType": "string"
    },
    "claimed_at": {
      "bsonType": ["date", "null"]
    },
    "revoked_at": {
      "bsonType": ["date", "null"]
    },
    "revoke_reason": {
      "bsonType": ["string", "null"]
    },
    "created_by": {
      "bsonType": ["objectId", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["device_id", "kind", "secret_key_hash"]
})
db.getCollection("provisioneddevices").createIndex({"device_id":1}, {"unique":true})

// ── relayoverridelogs (model RelayOverrideLog) ──
ensureCollection("relayoverridelogs", {
  "bsonType": "object",
  "properties": {
    "node_id": {
      "bsonType": "objectId"
    },
    "zone_id": {
      "bsonType": "objectId"
    },
    "farm_id": {
      "bsonType": "objectId"
    },
    "relay": {
      "bsonType": "string",
      "enum": ["misting", "ventilation", "speaker"]
    },
    "state": {
      "bsonType": "bool"
    },
    "started_by": {
      "bsonType": "objectId"
    },
    "started_by_role": {
      "bsonType": "string"
    },
    "started_at": {
      "bsonType": "date"
    },
    "expires_at": {
      "bsonType": "date"
    },
    "ended_at": {
      "bsonType": ["date", "null"]
    },
    "end_reason": {
      "bsonType": ["string", "null"],
      "enum": ["EXPIRED", "CLEARED_EARLY", "REPLACED", null]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["node_id", "zone_id", "farm_id", "relay", "state", "started_by", "started_by_role", "started_at", "expires_at"]
})
db.getCollection("relayoverridelogs").createIndex({"node_id":1,"started_at":-1})
db.getCollection("relayoverridelogs").createIndex({"zone_id":1,"started_at":-1})
db.getCollection("relayoverridelogs").createIndex({"ended_at":1,"expires_at":1})

// ── sensornodes (model SensorNode) ──
ensureCollection("sensornodes", {
  "bsonType": "object",
  "properties": {
    "device_id": {
      "bsonType": "string"
    },
    "zone_id": {
      "bsonType": "objectId"
    },
    "firmware_version": {
      "bsonType": ["string", "null"]
    },
    "ota_pending": {
      "bsonType": ["object", "null"],
      "properties": {
        "version": {
          "bsonType": "string"
        },
        "url": {
          "bsonType": "string"
        },
        "requested_at": {
          "bsonType": "date"
        },
        "requested_by": {
          "bsonType": ["objectId", "null"]
        }
      },
      "required": ["version", "url", "requested_at"]
    },
    "ota_failed": {
      "bsonType": ["object", "null"],
      "properties": {
        "version": {
          "bsonType": "string"
        },
        "failed_at": {
          "bsonType": "date"
        },
        "running_version": {
          "bsonType": ["string", "null"]
        }
      },
      "required": ["version", "failed_at"]
    },
    "last_heartbeat": {
      "bsonType": ["date", "null"]
    },
    "status": {
      "bsonType": ["string", "null"],
      "enum": ["PENDING", "ONLINE", "OFFLINE", null]
    },
    "rssi": {
      "bsonType": ["number", "null"]
    },
    "booted_at": {
      "bsonType": ["date", "null"]
    },
    "free_heap": {
      "bsonType": ["number", "null"]
    },
    "reset_reason": {
      "bsonType": ["string", "null"]
    },
    "ip": {
      "bsonType": ["string", "null"]
    },
    "relay_states": {
      "bsonType": ["object", "null"],
      "properties": {
        "misting": {
          "bsonType": ["bool", "null"]
        },
        "speaker": {
          "bsonType": ["bool", "null"]
        },
        "ventilation": {
          "bsonType": ["bool", "null"]
        }
      }
    },
    "control_mode": {
      "bsonType": ["string", "null"],
      "enum": ["AUTO", "MANUAL", null]
    },
    "override_expiry": {
      "bsonType": ["date", "null"]
    },
    "speaker_schedule": {
      "bsonType": ["object", "null"],
      "properties": {
        "enabled": {
          "bsonType": ["bool", "null"]
        },
        "windows": {
          "bsonType": ["array", "null"],
          "items": {
            "bsonType": "object",
            "properties": {
              "start": {
                "bsonType": ["string", "null"]
              },
              "end": {
                "bsonType": ["string", "null"]
              },
              "_id": {
                "bsonType": ["objectId", "null"]
              }
            }
          }
        }
      }
    },
    "audio": {
      "bsonType": ["object", "null"],
      "properties": {
        "current_track": {
          "bsonType": ["number", "null"]
        },
        "volume": {
          "bsonType": ["number", "null"]
        },
        "playing": {
          "bsonType": ["bool", "null"]
        },
        "loop": {
          "bsonType": ["bool", "null"]
        }
      }
    },
    "registered_at": {
      "bsonType": ["date", "null"]
    },
    "registered_by": {
      "bsonType": ["objectId", "null"]
    },
    "activation_overdue_at": {
      "bsonType": ["date", "null"]
    },
    "decommissioned_at": {
      "bsonType": ["date", "null"]
    },
    "decommission_reason": {
      "bsonType": ["string", "null"]
    },
    "replaced_by": {
      "bsonType": ["objectId", "null"]
    },
    "relay_usage": {
      "bsonType": ["object", "null"],
      "properties": {
        "misting": {
          "bsonType": ["object", "null"],
          "properties": {
            "on_hours": {
              "bsonType": ["number", "null"]
            },
            "switches": {
              "bsonType": ["number", "null"]
            },
            "since_service_hours": {
              "bsonType": ["number", "null"]
            },
            "since_service_switches": {
              "bsonType": ["number", "null"]
            }
          }
        },
        "ventilation": {
          "bsonType": ["object", "null"],
          "properties": {
            "on_hours": {
              "bsonType": ["number", "null"]
            },
            "switches": {
              "bsonType": ["number", "null"]
            },
            "since_service_hours": {
              "bsonType": ["number", "null"]
            },
            "since_service_switches": {
              "bsonType": ["number", "null"]
            }
          }
        },
        "counted_until": {
          "bsonType": ["date", "null"]
        },
        "last_misting_on": {
          "bsonType": ["bool", "null"]
        },
        "last_ventilation_on": {
          "bsonType": ["bool", "null"]
        }
      }
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["device_id", "zone_id"]
})
db.getCollection("sensornodes").createIndex({"device_id":1}, {"unique":true})
db.getCollection("sensornodes").createIndex({"status":1,"last_heartbeat":1})
db.getCollection("sensornodes").createIndex({"zone_id":1})
db.getCollection("sensornodes").createIndex({"status":1,"registered_at":1})

// ── systemsettings (model SystemSetting) ──
ensureCollection("systemsettings", {
  "bsonType": "object",
  "properties": {
    "_singleton": {
      "bsonType": ["bool", "null"]
    },
    "default_thresholds": {
      "bsonType": ["object", "null"],
      "properties": {
        "temp_min": {
          "bsonType": "number"
        },
        "temp_max": {
          "bsonType": "number"
        },
        "humidity_min": {
          "bsonType": "number"
        },
        "humidity_max": {
          "bsonType": "number"
        },
        "light_max": {
          "bsonType": "number"
        },
        "nh3_max": {
          "bsonType": "number"
        },
        "co2_max": {
          "bsonType": "number"
        }
      },
      "required": ["temp_min", "temp_max", "humidity_min", "humidity_max", "light_max", "nh3_max", "co2_max"]
    },
    "updated_by": {
      "bsonType": ["objectId", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "updated_at": {
      "bsonType": ["date", "null"]
    }
  }
})
db.getCollection("systemsettings").createIndex({"_singleton":1}, {"unique":true})

// ── telemetries (model Telemetry) ──
ensureCollection("telemetries", {
  "bsonType": "object",
  "properties": {
    "node_id": {
      "bsonType": "objectId"
    },
    "zone_id": {
      "bsonType": "objectId"
    },
    "timestamp": {
      "bsonType": "date"
    },
    "temperature": {
      "bsonType": ["number", "null"]
    },
    "humidity": {
      "bsonType": ["number", "null"]
    },
    "light_lux": {
      "bsonType": ["number", "null"]
    },
    "nh3_ppm": {
      "bsonType": ["number", "null"]
    },
    "co2_ppm": {
      "bsonType": ["number", "null"]
    },
    "sound_db": {
      "bsonType": ["number", "null"]
    },
    "misting_pct": {
      "bsonType": ["number", "null"]
    },
    "ventilation_pct": {
      "bsonType": ["number", "null"]
    },
    "misting_on": {
      "bsonType": ["bool", "null"]
    },
    "ventilation_on": {
      "bsonType": ["bool", "null"]
    },
    "is_anomaly": {
      "bsonType": ["bool", "null"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["node_id", "zone_id", "timestamp"]
})
db.getCollection("telemetries").createIndex({"zone_id":1,"timestamp":-1})
db.getCollection("telemetries").createIndex({"timestamp":1}, {"expireAfterSeconds":7776000})

// ── users (model User) ──
ensureCollection("users", {
  "bsonType": "object",
  "properties": {
    "email": {
      "bsonType": "string"
    },
    "phone": {
      "bsonType": ["string", "null"]
    },
    "password_hash": {
      "bsonType": "string"
    },
    "full_name": {
      "bsonType": "string"
    },
    "role": {
      "bsonType": ["string", "null"],
      "enum": ["ADMIN", "FARM_OWNER", "DOMAIN_EXPERT", "TECHNICIAN", null]
    },
    "avatar_url": {
      "bsonType": ["string", "null"]
    },
    "is_active": {
      "bsonType": ["bool", "null"]
    },
    "must_change_password": {
      "bsonType": ["bool", "null"]
    },
    "deactivated_at": {
      "bsonType": ["date", "null"]
    },
    "deactivated_reason": {
      "bsonType": ["string", "null"]
    },
    "notification_preferences": {
      "bsonType": ["object", "null"],
      "properties": {
        "push": {
          "bsonType": ["bool", "null"]
        },
        "telegram": {
          "bsonType": ["bool", "null"]
        },
        "quiet_hours": {
          "bsonType": ["object", "null"],
          "properties": {
            "start": {
              "bsonType": ["string", "null"]
            },
            "end": {
              "bsonType": ["string", "null"]
            }
          }
        }
      }
    },
    "telegram_chat_id": {
      "bsonType": ["string", "null"]
    },
    "telegram_link_code_hash": {
      "bsonType": ["string", "null"]
    },
    "telegram_link_expires_at": {
      "bsonType": ["date", "null"]
    },
    "password_reset_token_hash": {
      "bsonType": ["string", "null"]
    },
    "password_reset_expires_at": {
      "bsonType": ["date", "null"]
    },
    "deletion_requested_at": {
      "bsonType": ["date", "null"]
    },
    "deletion_reminder_sent_at": {
      "bsonType": ["date", "null"]
    },
    "deleted_at": {
      "bsonType": ["date", "null"]
    },
    "refresh_tokens": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "token_hash": {
            "bsonType": ["string", "null"]
          },
          "expires": {
            "bsonType": ["date", "null"]
          },
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updated_at": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["email", "password_hash", "full_name"]
})
db.getCollection("users").createIndex({"email":1}, {"unique":true})
db.getCollection("users").createIndex({"telegram_link_code_hash":1}, {"sparse":true})

// ── zonehealthreports (model ZoneHealthReport) ──
ensureCollection("zonehealthreports", {
  "bsonType": "object",
  "properties": {
    "farm_id": {
      "bsonType": "objectId"
    },
    "zone_id": {
      "bsonType": "objectId"
    },
    "period_start": {
      "bsonType": "date"
    },
    "period_end": {
      "bsonType": "date"
    },
    "metrics": {},
    "generated_at": {
      "bsonType": ["date", "null"]
    },
    "expert_conclusion": {
      "bsonType": ["object", "null"],
      "properties": {
        "text": {
          "bsonType": "string"
        },
        "by": {
          "bsonType": "objectId"
        },
        "at": {
          "bsonType": "date"
        },
        "edited_at": {
          "bsonType": ["date", "null"]
        }
      },
      "required": ["text", "by", "at"]
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    }
  },
  "required": ["farm_id", "zone_id", "period_start", "period_end", "metrics"]
})
db.getCollection("zonehealthreports").createIndex({"zone_id":1,"period_end":-1}, {"unique":true})

// ── zones (model Zone) ──
ensureCollection("zones", {
  "bsonType": "object",
  "properties": {
    "house_id": {
      "bsonType": "objectId"
    },
    "farm_id": {
      "bsonType": "objectId"
    },
    "name": {
      "bsonType": "string"
    },
    "floor": {
      "bsonType": ["number", "null"]
    },
    "thresholds": {
      "bsonType": ["object", "null"],
      "properties": {
        "temp_min": {
          "bsonType": ["number", "null"]
        },
        "temp_max": {
          "bsonType": ["number", "null"]
        },
        "humidity_min": {
          "bsonType": ["number", "null"]
        },
        "humidity_max": {
          "bsonType": ["number", "null"]
        },
        "light_max": {
          "bsonType": ["number", "null"]
        },
        "nh3_max": {
          "bsonType": ["number", "null"]
        },
        "co2_max": {
          "bsonType": ["number", "null"]
        }
      }
    },
    "threshold_history": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "changed_by": {
            "bsonType": ["objectId", "null"]
          },
          "changed_at": {
            "bsonType": ["date", "null"]
          },
          "old_values": {},
          "new_values": {},
          "source": {
            "bsonType": ["string", "null"],
            "enum": ["MANUAL", "RESET_TO_DEFAULT", "EXPERT_REVERT", null]
          },
          "changed_by_role": {
            "bsonType": ["string", "null"]
          },
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "fuzzy_tuning": {
      "bsonType": ["object", "null"],
      "properties": {
        "fuzzy_humidity_band": {
          "bsonType": ["number", "null"]
        },
        "fuzzy_temp_band": {
          "bsonType": ["number", "null"]
        },
        "fuzzy_fan_dry_level": {
          "bsonType": ["number", "null"]
        },
        "fuzzy_window_sec": {
          "bsonType": ["number", "null"]
        },
        "fuzzy_input_filter": {
          "bsonType": ["bool", "null"]
        }
      }
    },
    "fuzzy_tuning_history": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "changed_by": {
            "bsonType": ["objectId", "null"]
          },
          "changed_by_role": {
            "bsonType": ["string", "null"]
          },
          "changed_at": {
            "bsonType": ["date", "null"]
          },
          "old_values": {},
          "new_values": {},
          "source": {
            "bsonType": ["string", "null"],
            "enum": ["MANUAL", "EXPERT_REVERT", "SUGGESTION_APPROVED", null]
          },
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "detection_tuning": {
      "bsonType": ["object", "null"],
      "properties": {
        "noise_margin_db": {
          "bsonType": ["number", "null"]
        },
        "noise_min_sec": {
          "bsonType": ["number", "null"]
        },
        "pump_dry_on_sec": {
          "bsonType": ["number", "null"]
        },
        "pump_dry_min_rise_pct": {
          "bsonType": ["number", "null"]
        },
        "speaker_drop_pct": {
          "bsonType": ["number", "null"]
        }
      }
    },
    "detection_tuning_history": {
      "bsonType": ["array", "null"],
      "items": {
        "bsonType": "object",
        "properties": {
          "changed_by": {
            "bsonType": ["objectId", "null"]
          },
          "changed_by_role": {
            "bsonType": ["string", "null"]
          },
          "changed_at": {
            "bsonType": ["date", "null"]
          },
          "old_values": {},
          "new_values": {},
          "_id": {
            "bsonType": ["objectId", "null"]
          }
        }
      }
    },
    "_id": {
      "bsonType": ["objectId", "null"]
    },
    "created_at": {
      "bsonType": ["date", "null"]
    },
    "updatedAt": {
      "bsonType": ["date", "null"]
    }
  },
  "required": ["house_id", "farm_id", "name"]
})
db.getCollection("zones").createIndex({"house_id":1})
db.getCollection("zones").createIndex({"farm_id":1})
