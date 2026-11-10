-- phase: expand
CREATE TABLE public.request_analytics_metadata (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 history_started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.request_analytics_metadata(singleton) VALUES (true);
CREATE TABLE public.request_status_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
 status text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 is_baseline boolean NOT NULL
);
CREATE INDEX request_status_events_request_idx ON public.request_status_events(request_id,occurred_at,id);
CREATE INDEX request_status_events_time_idx ON public.request_status_events(occurred_at,status);
CREATE INDEX client_requests_analytics_created_idx ON public.client_requests(created_at);
CREATE INDEX client_requests_analytics_pending_idx ON public.client_requests(created_at,mentor_id) WHERE status='pending';
ALTER TABLE public.request_analytics_metadata OWNER TO om_migrate;
ALTER TABLE public.request_status_events OWNER TO om_migrate;
REVOKE ALL ON public.request_status_events,public.request_analytics_metadata FROM PUBLIC,om_api,om_worker;
GRANT SELECT ON public.request_status_events,public.request_analytics_metadata TO om_api,om_worker;
REVOKE ALL ON SEQUENCE public.request_status_events_id_seq FROM PUBLIC,om_api,om_worker;
CREATE FUNCTION public.record_request_status_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.request_status_events(request_id,status,is_baseline) VALUES(NEW.id,NEW.status,true);
 ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO public.request_status_events(request_id,status,is_baseline) VALUES(NEW.id,NEW.status,false);
 END IF;
 RETURN NEW;
END;
$$;
ALTER FUNCTION public.record_request_status_event() OWNER TO om_migrate;
REVOKE ALL ON FUNCTION public.record_request_status_event() FROM PUBLIC,om_api,om_worker;
CREATE TRIGGER request_status_history AFTER INSERT OR UPDATE OF status ON public.client_requests
 FOR EACH ROW EXECUTE FUNCTION public.record_request_status_event();
