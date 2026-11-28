-- Imported messages retain immutable provenance separately from editable vacancies.
ALTER TABLE vacancies ALTER COLUMN industry_id DROP NOT NULL, ALTER COLUMN city_id DROP NOT NULL;
ALTER TABLE vacancies ADD CONSTRAINT vacancies_dictionary_required_for_public CHECK (status = 'draft' OR (industry_id IS NOT NULL AND city_id IS NOT NULL));
CREATE TABLE telegram_vacancy_sources (
 channel_id bigint NOT NULL,
 message_id bigint NOT NULL,
 vacancy_id text NOT NULL UNIQUE REFERENCES vacancies(id) ON DELETE CASCADE,
 raw_text text NOT NULL,
 photo_ids jsonb NOT NULL,
 source_url text NOT NULL,
 PRIMARY KEY(channel_id,message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON telegram_vacancy_sources TO om_api;
