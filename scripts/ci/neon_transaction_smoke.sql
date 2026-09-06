-- Run only on a disposable Neon branch in one SQL Editor execution.
-- Synthetic temporary rows; no application or authentication tables are touched.
-- This verifies PostgreSQL behavior, not application authorization or the adapter.
BEGIN;
CREATE TEMP TABLE jarvis_transaction_probe (
    owner_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (owner_id, session_id)
);
INSERT INTO jarvis_transaction_probe VALUES
    ('test-owner-a', 'same-session', '{"text":"Olá, Jarvis!"}'),
    ('test-owner-b', 'same-session', '{"text":"Another owner"}');
SAVEPOINT before_update;
UPDATE jarvis_transaction_probe SET payload = '{"text":"temporary"}'
WHERE owner_id = 'test-owner-a' AND session_id = 'same-session';
ROLLBACK TO SAVEPOINT before_update;
SELECT
    current_database() AS database_name,
    count(*) = 2 AS composite_identity_ok,
    count(*) FILTER (WHERE owner_id = 'test-owner-a') = 1 AS scoped_query_ok,
    bool_or(owner_id = 'test-owner-a' AND payload->>'text' = 'Olá, Jarvis!')
        AS unicode_and_savepoint_ok
FROM jarvis_transaction_probe;
ROLLBACK;
SELECT to_regclass('pg_temp.jarvis_transaction_probe') IS NULL AS rollback_cleanup_ok;
