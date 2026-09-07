-- Migration 004: Remote Tool Approvals
-- Stores pending and decided action approvals requested by paired desktop devices.

CREATE TABLE IF NOT EXISTS cloud_tool_approvals_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES cloud_user_profiles_v1(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  risk_tier TEXT NOT NULL DEFAULT 'ask',
  reason TEXT,
  args_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  decision_by TEXT,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  CONSTRAINT unique_device_trace UNIQUE (device_id, trace_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_approvals_owner_status ON cloud_tool_approvals_v1(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_device_trace ON cloud_tool_approvals_v1(device_id, trace_id);
CREATE INDEX IF NOT EXISTS idx_tool_approvals_device_status ON cloud_tool_approvals_v1(device_id, status);
