-- Migration 003: Authenticated Device Pairing (Mac Desktop <-> Cloud)
-- Stores single-use ephemeral pairing codes and verified claimed devices.

CREATE TABLE IF NOT EXISTS cloud_device_pairings_v1 (
  code_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  device_id TEXT,
  device_name TEXT,
  device_token_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_cloud_pairings_owner ON cloud_device_pairings_v1(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_cloud_pairings_device ON cloud_device_pairings_v1(device_id);
