BEGIN;
CREATE TABLE IF NOT EXISTS cloud_chat_conversations_v1 (
  owner_id TEXT NOT NULL,
  id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE IF NOT EXISTS cloud_chat_turns_v1 (
  owner_id TEXT NOT NULL,
  request_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  user_text TEXT NOT NULL CHECK (length(user_text) BETWEEN 1 AND 4000),
  assistant_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending','complete','failed')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_usd NUMERIC(12,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '90 seconds',
  PRIMARY KEY (owner_id, request_id),
  FOREIGN KEY (owner_id, conversation_id) REFERENCES cloud_chat_conversations_v1(owner_id,id)
);
CREATE INDEX IF NOT EXISTS cloud_chat_turns_history_v1
  ON cloud_chat_turns_v1(owner_id,conversation_id,created_at);
CREATE TABLE IF NOT EXISTS cloud_chat_budget_v1 (
  owner_id TEXT NOT NULL,
  day DATE NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (owner_id,day)
);
COMMIT;
