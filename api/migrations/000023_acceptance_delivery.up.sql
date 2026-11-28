-- phase: expand
ALTER TABLE client_requests ADD COLUMN acceptance_notification_sent_at timestamptz;
-- Existing claims have an unknown outcome; avoid automatically duplicating them.
UPDATE client_requests SET acceptance_notification_sent_at = acceptance_notification_claimed_at WHERE acceptance_notification_claimed_at IS NOT NULL;
CREATE INDEX client_requests_acceptance_pending_idx ON client_requests (accepted_at) WHERE accepted_at IS NOT NULL AND acceptance_notification_sent_at IS NULL;
