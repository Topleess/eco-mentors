-- phase: expand
CREATE TABLE feedback_submissions (
    id uuid PRIMARY KEY CHECK (id::text ~ '^........-....-4...-[89ab]...-............$'),
    category text NOT NULL CHECK (category IN ('suggestion', 'problem', 'question')),
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000 AND message ~ '[^[:space:]]'),
    email text CHECK (octet_length(email) BETWEEN 1 AND 254),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_submissions_newest_idx ON feedback_submissions (created_at DESC, id DESC);

REVOKE ALL ON feedback_submissions FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'om_worker') THEN
        REVOKE ALL ON feedback_submissions FROM om_worker;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'om_api') THEN
        REVOKE ALL ON feedback_submissions FROM om_api;
        GRANT SELECT ON feedback_submissions TO om_api;
        GRANT INSERT (id, category, message, email) ON feedback_submissions TO om_api;
    END IF;
END $$;
