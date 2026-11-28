ALTER TABLE client_requests ADD COLUMN accepted_at timestamptz, ADD COLUMN accepted_contact text, ADD COLUMN acceptance_notification_claimed_at timestamptz;
