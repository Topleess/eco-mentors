-- phase: contract
-- Irreversibly discards observed history and its coverage boundary.
DROP TRIGGER request_status_history ON public.client_requests;
DROP FUNCTION public.record_request_status_event();
DROP TABLE public.request_status_events;
DROP TABLE public.request_analytics_metadata;
DROP INDEX public.client_requests_analytics_created_idx;
DROP INDEX public.client_requests_analytics_pending_idx;
