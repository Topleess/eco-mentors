-- New events only: historical delivery outcomes are unknown and are not replayed.
CREATE TABLE request_deliveries (
 request_id uuid NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('mentee','mentor','moderator','decline')),
 sent_at timestamptz, claim_token uuid, claimed_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (request_id, kind)
);
CREATE INDEX request_deliveries_pending_idx ON request_deliveries(next_attempt_at) WHERE sent_at IS NULL;
CREATE FUNCTION enqueue_request_deliveries() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.status_changed_at IS NULL THEN
  INSERT INTO request_deliveries(request_id,kind) SELECT NEW.id, unnest(ARRAY['mentee','mentor','moderator']);
 ELSIF TG_OP = 'UPDATE' AND NEW.status = 'declined' AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO request_deliveries(request_id,kind) VALUES (NEW.id,'decline') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enqueue_request_deliveries_trigger AFTER INSERT OR UPDATE OF status ON client_requests FOR EACH ROW EXECUTE FUNCTION enqueue_request_deliveries();
