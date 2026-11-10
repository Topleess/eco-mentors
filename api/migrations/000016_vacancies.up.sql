-- phase: expand
CREATE TABLE vacancy_industries (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 150),
 active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vacancy_cities (LIKE vacancy_industries INCLUDING ALL);
CREATE TABLE vacancies (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 industry_id text NOT NULL REFERENCES vacancy_industries(id) ON DELETE RESTRICT,
 city_id text NOT NULL REFERENCES vacancy_cities(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK (status IN ('draft','published','archived')),
 payload jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vacancies_public_idx ON vacancies(status,created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacancy_industries, vacancy_cities, vacancies TO om_api;
