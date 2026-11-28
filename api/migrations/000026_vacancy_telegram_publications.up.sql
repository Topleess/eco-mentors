-- phase: expand
CREATE TABLE vacancy_telegram_publications (
 vacancy_id text PRIMARY KEY REFERENCES vacancies(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK (version > 0),
 message_id bigint CHECK (message_id > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON vacancy_telegram_publications TO om_api;
