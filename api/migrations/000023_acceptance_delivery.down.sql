-- phase: contract
DROP INDEX client_requests_acceptance_pending_idx;
ALTER TABLE client_requests DROP COLUMN acceptance_notification_sent_at;
