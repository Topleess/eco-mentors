CREATE TABLE telegram_vacancy_offsets (
 bot_key text PRIMARY KEY,
 next_update_id bigint NOT NULL CHECK (next_update_id >= 0)
);
GRANT SELECT, INSERT, UPDATE ON telegram_vacancy_offsets TO om_api;
