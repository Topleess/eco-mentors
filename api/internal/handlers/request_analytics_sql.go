package handlers

const requestAnalyticsSQL = `
WITH params AS (SELECT $1::timestamptz a,$2::timestamptz b,transaction_timestamp() generated),
meta AS (SELECT history_started_at FROM request_analytics_metadata WHERE singleton),
cohort AS (SELECT r.* FROM client_requests r,params p WHERE r.created_at>=p.a AND r.created_at<p.b),
eligible AS (SELECT c.* FROM cohort c,meta m WHERE c.created_at>=m.history_started_at),
overdue AS (SELECT r.* FROM client_requests r,params p WHERE r.status='pending' AND r.created_at<=p.generated-interval '72 hours'),
status_names AS (SELECT * FROM unnest(ARRAY['pending','contacted','working','done','reschedule','declined','unavailable']) WITH ORDINALITY sn(status,ord)),
funnel_names AS (SELECT * FROM unnest(ARRAY['pending','contacted','working','done']) WITH ORDINALITY fn(status,ord)),
ordered AS (SELECT e.*,lead(occurred_at) OVER (PARTITION BY e.request_id ORDER BY e.occurred_at,e.id) next_at FROM request_status_events e JOIN eligible c ON c.id=e.request_id),
intervals AS (SELECT status stage,extract(epoch FROM next_at-occurred_at)/3600 hours FROM ordered WHERE next_at IS NOT NULL AND next_at>=occurred_at AND status IN ('pending','contacted','working')
 UNION ALL SELECT 'total',extract(epoch FROM min(e.occurred_at)-c.created_at)/3600 FROM eligible c JOIN request_status_events e ON e.request_id=c.id AND e.status='done' GROUP BY c.id,c.created_at HAVING min(e.occurred_at)>=c.created_at),
duration_rows AS (SELECT s.stage,percentile_cont(0.5) WITHIN GROUP(ORDER BY i.hours) median,percentile_cont(0.9) WITHIN GROUP(ORDER BY i.hours) p90,count(i.hours) samples FROM unnest(ARRAY['pending','contacted','working','total']) WITH ORDINALITY s(stage,ord) LEFT JOIN intervals i USING(stage) GROUP BY s.stage,s.ord ORDER BY s.ord),
mentor_ids AS (SELECT mentor_id FROM cohort UNION SELECT mentor_id FROM overdue),
mentor_rows AS (SELECT coalesce(i.mentor_id::text,'') id,coalesce(m.name,'Unknown mentor') name,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id) created,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='pending') pending,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='contacted') contacted,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='working') working,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='done') done,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='declined') declined,
 (SELECT count(*) FROM cohort c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id AND status='unavailable') unavailable,
 (SELECT count(*) FROM overdue c WHERE c.mentor_id IS NOT DISTINCT FROM i.mentor_id) attention
 FROM mentor_ids i LEFT JOIN mentors m ON m.id=i.mentor_id)
SELECT jsonb_build_object(
 'range',jsonb_build_object('startDate',to_char(p.a AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD'),'endDate',to_char((p.b-interval '1 day') AT TIME ZONE 'Europe/Moscow','YYYY-MM-DD'),'timezone','Europe/Moscow'),
 'generatedAt',p.generated,'historyStartedAt',m.history_started_at,
 'historyCoverage',jsonb_build_object('eligible',(SELECT count(*) FROM eligible),'total',(SELECT count(*) FROM cohort)),
 'summary',jsonb_build_object('created',(SELECT count(*) FROM cohort),'previousCreated',(SELECT count(*) FROM client_requests WHERE created_at>=p.a-(p.b-p.a) AND created_at<p.a),'active',(SELECT count(*) FROM cohort WHERE status IN ('pending','contacted','working')),'done',(SELECT count(*) FROM cohort WHERE status='done'),'declined',(SELECT count(*) FROM cohort WHERE status='declined'),'attention',(SELECT count(*) FROM overdue)),
 'daily',(SELECT jsonb_agg(jsonb_build_object('date',to_char(d,'YYYY-MM-DD'),'created',(SELECT count(*) FROM cohort WHERE (created_at AT TIME ZONE 'Europe/Moscow')::date=d::date),'done',(SELECT count(*) FROM request_status_events WHERE status='done' AND NOT is_baseline AND (occurred_at AT TIME ZONE 'Europe/Moscow')::date=d::date),'declined',(SELECT count(*) FROM request_status_events WHERE status='declined' AND NOT is_baseline AND (occurred_at AT TIME ZONE 'Europe/Moscow')::date=d::date)) ORDER BY d) FROM generate_series((p.a AT TIME ZONE 'Europe/Moscow')::date,((p.b AT TIME ZONE 'Europe/Moscow')::date-1),interval '1 day') d),
 'statuses',(SELECT jsonb_agg(jsonb_build_object('status',s.status,'count',(SELECT count(*) FROM cohort c WHERE c.status=s.status)) ORDER BY s.ord) FROM status_names s),
 'funnel',(SELECT jsonb_agg(jsonb_build_object('status',s.status,'count',CASE WHEN s.status='pending' THEN (SELECT count(*) FROM eligible) ELSE (SELECT count(DISTINCT e.request_id) FROM request_status_events e JOIN eligible c ON c.id=e.request_id WHERE e.status=s.status) END) ORDER BY s.ord) FROM funnel_names s),
 'durations',(SELECT jsonb_agg(jsonb_build_object('stage',stage,'medianHours',median,'p90Hours',p90,'sampleCount',samples) ORDER BY array_position(ARRAY['pending','contacted','working','total'],stage)) FROM duration_rows),
 'mentors',coalesce((SELECT jsonb_agg(to_jsonb(mr) ORDER BY name,id) FROM mentor_rows mr),'[]'::jsonb),
 'declineReasons',coalesce((SELECT jsonb_agg(jsonb_build_object('reason',reason,'count',n) ORDER BY reason) FROM (SELECT coalesce(decline_reason,'unspecified') reason,count(*) n FROM cohort WHERE status='declined' GROUP BY 1) reasons),'[]'::jsonb),
 'attention',coalesce((SELECT jsonb_agg(jsonb_build_object('mentorId',coalesce(mentor_id::text,''),'mentorName',name,'count',n,'oldestCreatedAt',oldest) ORDER BY oldest) FROM (SELECT o.mentor_id,coalesce(mt.name,'Unknown mentor') name,count(*) n,min(o.created_at) oldest FROM overdue o LEFT JOIN mentors mt ON mt.id=o.mentor_id GROUP BY o.mentor_id,mt.name) attention),'[]'::jsonb)
) FROM params p CROSS JOIN meta m
`
