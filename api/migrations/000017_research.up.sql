-- phase: expand
CREATE TABLE research (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (length(slug) <= 100),
 status text NOT NULL CHECK (status IN ('draft','published','archived')),
 provenance text NOT NULL DEFAULT 'manual' CHECK (provenance IN ('manual','synthetic')),
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX research_published_idx ON research(created_at,id) WHERE status='published';
