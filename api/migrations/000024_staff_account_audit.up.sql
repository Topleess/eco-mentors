-- phase: expand
CREATE TABLE staff_account_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  target_id UUID NOT NULL,
  action TEXT NOT NULL,
  new_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
