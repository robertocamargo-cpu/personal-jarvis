BEGIN;
CREATE TABLE IF NOT EXISTS cloud_google_connections_v1 (
  owner_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  account_email TEXT,
  token_ciphertext TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cloud_google_states_v1 (
  owner_id TEXT PRIMARY KEY REFERENCES cloud_google_connections_v1(owner_id),
  state_hash TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  version INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes'
);
COMMIT;
