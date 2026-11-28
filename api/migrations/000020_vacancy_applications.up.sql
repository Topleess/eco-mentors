-- phase: expand
CREATE TABLE vacancy_applications (vacancy_id text PRIMARY KEY REFERENCES vacancies(id) ON DELETE CASCADE, contact text NOT NULL CHECK (length(trim(contact)) BETWEEN 1 AND 500));
GRANT SELECT, INSERT, UPDATE, DELETE ON vacancy_applications TO om_api;
