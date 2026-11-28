-- Refuse rollback if incomplete imports remain; never silently delete drafts.
DROP TABLE telegram_vacancy_sources;
ALTER TABLE vacancies DROP CONSTRAINT vacancies_dictionary_required_for_public;
ALTER TABLE vacancies ALTER COLUMN industry_id SET NOT NULL, ALTER COLUMN city_id SET NOT NULL;
