-- Migration 005: Web Push Subscriptions and Mac Chat Queue

-- 1. Web Push Subscriptions for mobile devices
CREATE TABLE IF NOT EXISTS cloud_push_subscriptions_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES cloud_user_profiles_v1(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_owner ON cloud_push_subscriptions_v1(owner_id);

-- 2. Mac Chat Message Queue for bidirectional desktop interaction
CREATE TABLE IF NOT EXISTS cloud_mac_messages_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES cloud_user_profiles_v1(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  user_text TEXT NOT NULL,
  assistant_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mac_messages_device_status ON cloud_mac_messages_v1(device_id, status);
CREATE INDEX IF NOT EXISTS idx_mac_messages_owner_conv ON cloud_mac_messages_v1(owner_id, conversation_id);
